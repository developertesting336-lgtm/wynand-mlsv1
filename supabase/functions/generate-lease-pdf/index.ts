import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

export const getCorsHeaders = (originHeader: string | null) => ({
    "Access-Control-Allow-Origin": originHeader ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

        const authHeader = req.headers.get('Authorization');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader || '' } },
        });

        const {
            bookingId,
            agreementConditions,
            tenantSignature,
            tenantSignatureDate,
            agentSignature,
            agentSignatureDate
        } = await req.json();

        if (!bookingId) {
            return new Response(JSON.stringify({ error: "bookingId is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 1. Fetch the booking
        const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", bookingId)
            .single();

        if (bookingError || !booking) {
            return new Response(JSON.stringify({ error: "Booking not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Fetch the listing
        const { data: listing, error: listingError } = await supabase
            .from("listings")
            .select("*")
            .eq("id", booking.listing_id)
            .single();

        if (listingError || !listing) {
            throw new Error("Listing not found");
        }

        // 3. Fetch Profiles
        const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || supabaseAnonKey);

        const { data: renterProfile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", booking.renter_id)
            .single();

        const { data: ownerProfile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", booking.owner_id)
            .single();

        let agentProfile = null;
        if (booking.agent_id) {
            const { data: ap } = await supabaseAdmin
                .from("profiles")
                .select("*")
                .eq("id", booking.agent_id)
                .maybeSingle();
            agentProfile = ap;
        }

        const conditions = {
            ...(booking.agreement_conditions || {}),
            ...(agreementConditions || {})
        };

        // Helper: Upload Signatures to Supabase Storage
        const uploadSignature = async (signatureDataUrl: string, fileName: string) => {
            if (!signatureDataUrl) return null;
            try {
                const base64Data = signatureDataUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'image/png' });
                const filePath = `signatures/${bookingId}-${fileName}-${Date.now()}.png`;

                const { error: uploadError } = await supabaseAdmin
                    .storage
                    .from("MLS")
                    .upload(filePath, blob, {
                        contentType: "image/png",
                        upsert: true
                    });

                if (uploadError) {
                    console.error(`[PDF Gen] Upload signature failed:`, uploadError);
                    return null;
                }

                const { data: { publicUrl } } = await supabaseAdmin
                    .storage
                    .from("MLS")
                    .getPublicUrl(filePath);

                return publicUrl;
            } catch (err) {
                console.error(`[PDF Gen] Failed to upload ${fileName}:`, err);
                return null;
            }
        };

        const isUrl = (value: string | undefined | null) => typeof value === 'string' && value.startsWith('http');

        let landlordSignatureUrl = conditions.landlordSignature;
        if (landlordSignatureUrl && !isUrl(landlordSignatureUrl)) {
            landlordSignatureUrl = await uploadSignature(landlordSignatureUrl, 'landlord');
        }

        let agentSignatureUrl = agentSignature || conditions.agentSignature;
        if (agentSignatureUrl && !isUrl(agentSignatureUrl)) {
            agentSignatureUrl = await uploadSignature(agentSignatureUrl, 'agent');
        }

        let tenantSignatureUrl = tenantSignature || conditions.tenantSignature;
        if (tenantSignatureUrl && !isUrl(tenantSignatureUrl)) {
            tenantSignatureUrl = await uploadSignature(tenantSignatureUrl, 'tenant');
        }

        const formatDate = (dateStr: string | Date) => {
            const d = new Date(dateStr);
            const day = d.getDate();
            const month = d.toLocaleDateString("en-US", { month: "short" });
            const year = d.getFullYear();
            return `${day} ${month}, ${year}`;
        };

        const formatSignatureDate = (dateStr: string | undefined | null) => {
            if (!dateStr) return "";
            if (dateStr.includes(',')) return dateStr;
            try {
                const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
                if (isNaN(d.getTime())) return "";
                return `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}, ${d.getFullYear()}`;
            } catch {
                return "";
            }
        };

        // Calculate details
        const rentAmount = listing.price_usd || 0;
        const leaseStart = booking.move_in_date || new Date().toISOString().split("T")[0];
        const leaseEnd = new Date(new Date(leaseStart).getTime() + (booking.lease_duration_months || 12) * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const lName = conditions.landlordName || ownerProfile?.full_name || ownerProfile?.email || "Owner";
        const tName = conditions.tenantName || renterProfile?.full_name || renterProfile?.email || "Renter";

        // 4. Inject Dynamic Conditions Directly into the Original HTML layout
        const htmlTemplate = `<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        body {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            line-height: 1.7;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
        }

        .page {
            padding: 30px;
            padding-bottom: 50px;
            page-break-after: always;
            box-sizing: border-box;
            position: relative;
        }

        .page:last-child {
            page-break-after: avoid;
        }

        /* Cover Page */
        .cover {
            text-align: center;
            padding: 150px 40px;
        }

        .cover-ornament-top {
            margin-bottom: 30px;
            font-size: 28px;
            color: #555;
        }

        .cover-ornament-bottom {
            margin-top: 30px;
            font-size: 28px;
            color: #555;
        }

        .cover h1 {
            font-size: 28px;
            font-weight: 600;
            letter-spacing: 1px;
            line-height: 1.4;
            margin: 0;
            padding: 30px 0;
            border-top: 1px solid #1a1a1a;
            border-bottom: 1px solid #1a1a1a;
            width: 100%;
        }

        /* Table Layout for TOC & Agreement */
        .bilingual-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        .bilingual-table th,
        .bilingual-table td {
            width: 50%;
            vertical-align: top;
            padding: 10px 12px;
            border: 1px solid #e0e0e0;
        }

        .bilingual-table th {
            background-color: #f8f9fa;
            font-weight: 600;
            text-align: left;
        }

        .section-title {
            font-weight: 700;
            text-align: center;
            background-color: #f1f3f5 !important;
            font-size: 11px;
            letter-spacing: 0.5px;
        }

        .section-header {
            font-weight: 700;
            text-align: center;
            padding: 12px !important;
            font-size: 11px;
            background-color: #e9ecef !important;
        }

        .toc-title {
            font-size: 18px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 20px;
        }

        .page-footer-initials {
            position: absolute;
            bottom: 15px;
            left: 30px;
            right: 30px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
        }

        .fill-blank {
            font-weight: normal;
            border-bottom: none;
            padding-bottom: 0px;
            display: inline;
        }

        /* Signatures Page Layout */
        .signatures-title {
            font-size: 18px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 30px;
            margin-top: 20px;
        }

        .sig-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px 30px;
            margin-top: 40px;
        }

        .sig-block {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .sig-line {
            width: 100%;
            border-top: 1px solid #000;
            margin-top: 40px;
            margin-bottom: 6px;
        }

        .sig-image {
            max-height: 70px;
            object-fit: contain;
            margin-bottom: -35px;
            align-self: center;
        }

        .sig-label {
            font-weight: 600;
            font-size: 12px;
        }

        .sig-name {
            font-size: 12px;
            color: #555;
        }
    </style>
</head>

<body>

    <!-- PAGE 1: COVER PAGE -->
    <div class="page">
        <div class="cover">
            <div class="cover-ornament-top">❦ ❧</div>
            <h1>CONTRATO DE ARRENDAMIENTO / LEASE AGREEMENT</h1>
            <div class="cover-ornament-bottom">❧ ❦</div>
        </div>
    </div>

    <!-- PAGE 2: TABLE OF CONTENTS (Part 1) -->
    <div class="page">
        <div class="toc-title">TABLA DE CONTENIDO / TABLE OF CONTENTS</div>
        <table class="bilingual-table">
            <thead>
                <tr>
                    <th>Español</th>
                    <th>English</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Declaraciones</td>
                    <td>Declarations</td>
                </tr>
                <tr>
                    <td>Cláusula 1 – Destino del Inmueble</td>
                    <td>Clause 1 – Use of Property</td>
                </tr>
                <tr>
                    <td>Cláusula 2 – Término</td>
                    <td>Clause 2 – Terms</td>
                </tr>
                <tr>
                    <td>Cláusula 3 – Precio de Renta y Pagos Iniciales</td>
                    <td>Clause 3 – Rent Price and Initial Payments</td>
                </tr>
                <tr>
                    <td>Cláusula 4 – Forma y Lugar de Pago</td>
                    <td>Clause 4 – Form and Place of Payment</td>
                </tr>
                <tr>
                    <td>Cláusula 5 – Depósito de Seguridad</td>
                    <td>Clause 5 – Security Deposit</td>
                </tr>
                <tr>
                    <td>Cláusula 6 – Rescisión del Contrato</td>
                    <td>Clause 6 – Rescission of the Contract</td>
                </tr>
                <tr>
                    <td>Cláusula 7 – Entrega y Recepción</td>
                    <td>Clause 7 – Delivery and Reception</td>
                </tr>
                <tr>
                    <td>Cláusula 8 – Instalaciones y Adecuaciones</td>
                    <td>Clause 8 – Installations and Modifications</td>
                </tr>
                <tr>
                    <td>Cláusula 9 – Sustancias Peligrosas</td>
                    <td>Clause 9 – Hazardous Substances</td>
                </tr>
                <tr>
                    <td>Cláusula 10 – Obligaciones del Arrendatario</td>
                    <td>Clause 10 – Tenant Obligations</td>
                </tr>
                <tr>
                    <td>Cláusula 11 – Responsabilidad del Arrendador y Arrendatario</td>
                    <td>Clause 11 – Responsibility of Landlord and Tenant</td>
                </tr>
                <tr>
                    <td>Cláusula 12 – Protección contra Extinción de Dominio</td>
                    <td>Clause 12 – Extinction of Domain Protection</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 3: TABLE OF CONTENTS (Part 2) -->
    <div class="page">
        <div class="toc-title">TABLA DE CONTENIDO / TABLE OF CONTENTS</div>
        <table class="bilingual-table">
            <thead>
                <tr>
                    <th>Español</th>
                    <th>English</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Cláusula 13 – Responsabilidad del Arrendador</td>
                    <td>Clause 13 – Landlord Liability</td>
                </tr>
                <tr>
                    <td>Cláusula 14 – Garantía</td>
                    <td>Clause 14 – Guarantee</td>
                </tr>
                <tr>
                    <td>Cláusula 15 – Vigencia</td>
                    <td>Clause 15 – Term</td>
                </tr>
                <tr>
                    <td>Cláusula 16 – Penalidad</td>
                    <td>Clause 16 – Penalty</td>
                </tr>
                <tr>
                    <td>Cláusula 17 – Relaciones con Terceros</td>
                    <td>Clause 17 – Relations with Third Parties</td>
                </tr>
                <tr>
                    <td>Cláusula 18 – Devolución de Depósito</td>
                    <td>Clause 18 – Return of Deposit</td>
                </tr>
                <tr>
                    <td>Cláusula 19 – Desalojo</td>
                    <td>Clause 19 – Eviction</td>
                </tr>
                <tr>
                    <td>Cláusula 20 – Confidencialidad y Protección de Datos</td>
                    <td>Clause 20 – Confidentiality and Data Protection</td>
                </tr>
                <tr>
                    <td>Cláusula 21 – Traducción</td>
                    <td>Clause 21 – Translation</td>
                </tr>
                <tr>
                    <td>Cláusula 22 – Aceptación de las Cláusulas</td>
                    <td>Clause 22 – Acceptance of Clauses</td>
                </tr>
                <tr>
                    <td>Cláusula 23 – Incremento de Renta Anual</td>
                    <td>Clause 23 – Annual Rent Increase</td>
                </tr>
                <tr>
                    <td>Cláusula 24 – Derecho de Tanto y Opción de Compra</td>
                    <td>Clause 24 – Right of First Refusal and Purchase Option</td>
                </tr>
                <tr>
                    <td>Jurisdicción y Competencia</td>
                    <td>Jurisdiction and Competence</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 4: TABLE OF CONTENTS (Part 3) -->
    <div class="page">
        <div class="toc-title">TABLA DE CONTENIDO / TABLE OF CONTENTS</div>
        <table class="bilingual-table">
            <thead>
                <tr>
                    <th>Español</th>
                    <th>English</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>CLÁUSULA ESPECIAL – CONDICIONES PARTICULARES</td>
                    <td>SPECIAL CLAUSE – SPECIAL CONDITIONS</td>
                </tr>
                <tr>
                    <td>Firmas</td>
                    <td>Signatures</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 5: AGREEMENT (Declarations) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>En la ciudad de <span class="fill-blank">${conditions.propertyCity || listing.city || "Puerto Vallarta"}</span>, <span
                            class="fill-blank">${conditions.propertyState || listing.state || "Jalisco"}</span>, las partes que comparecen para
                        ejecutar este Contrato de Arrendamiento son, por una parte, <span class="fill-blank">${lName}</span>, en
                        adelante denominada la “ARRENDADORA”; y por otra parte, <span class="fill-blank">${tName}</span>, actuando en su calidad de ‘ARRENDATARIO/A.</td>
                    <td>In the city of <span class="fill-blank">${conditions.propertyCity || listing.city || "Puerto Vallarta"}</span>, <span
                            class="fill-blank">${conditions.propertyState || listing.state || "Jalisco"}</span>, the parties appearing herein for the
                        purpose of executing this Lease Agreement are, on the one hand <span class="fill-blank">${lName}</span>,
                        hereinafter referred to as the “LANDLORD”; and on the other hand, <span class="fill-blank">${tName}</span>, acting in the capacity of the ‘TENANT.</td>
                </tr>
                <tr class="section-header">
                    <td>DECLARACIONES</td>
                    <td>DECLARATIONS</td>
                </tr>
                <tr>
                    <td style="border-bottom: none;"><strong>I. DEL ARRENDADOR:</strong> Declara ser ciudadana mexicana,
                        mayor de edad, con domicilio en: <span class="fill-blank">${conditions.ownerResidentialAddress || conditions.ownerAddress || ownerProfile?.address || "N/A"}${conditions.ownerResidentialCity ? `, ${conditions.ownerResidentialCity}` : ""}${conditions.ownerResidentialState ? `, ${conditions.ownerResidentialState}` : ""}</span>. Que
                        es legítimo propietario del inmueble ubicado en <span
                            class="fill-blank">${conditions.propertyAddress || listing.address || "N/A"}</span> y que cuenta con capacidad legal
                        suficiente para celebrar este contrato.</td>
                    <td style="border-bottom: none;"><strong>I. LANDLORD:</strong> Declares to be a Mexican citizen, of
                        legal age, domiciled at <span class="fill-blank">${conditions.ownerResidentialAddress || conditions.ownerAddress || ownerProfile?.address || "N/A"}${conditions.ownerResidentialCity ? `, ${conditions.ownerResidentialCity}` : ""}${conditions.ownerResidentialState ? `, ${conditions.ownerResidentialState}` : ""}</span>. That he is
                        the lawful owner of the property located at <span
                            class="fill-blank">${conditions.propertyAddress || listing.address || "N/A"}</span>, and has sufficient legal capacity to
                        execute this contract.
                    </td>
                </tr>
                <tr>
                    <td style="border-top: none;"><strong>Correo electrónico:</strong><br><span class="fill-blank">${ownerProfile?.email || "—"}</span><br><strong>Teléfono:</strong> <span class="fill-blank">${ownerProfile?.phone_number || "—"}</span></td>
                    <td style="border-top: none;"><strong>Email Address:</strong><br><span class="fill-blank">${ownerProfile?.email || "—"}</span><br><strong>Contact:</strong> <span class="fill-blank">${ownerProfile?.phone_number || "—"}</span></td>
                </tr>
                <tr>
                    <td><strong>II. ARRENDATARIO:</strong><br><span class="fill-blank">${tName}</span> declaran ser mayores de edad, de nacionalidad <span
                            class="fill-blank">${conditions.nationality || "—"}</span></td>
                    <td><strong>II. TENANT:</strong><br><span class="fill-blank">${tName}</span> declares to be of legal age, of <span class="fill-blank">${conditions.nationality || "—"}</span> nationality,</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 6: AGREEMENT (Declarations Continued & Clauses 1-2) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="border-bottom: none;">y con domicilio en <span
                            class="fill-blank">${conditions.tenantAddress || renterProfile?.address || "N/A"}</span>, con recursos económicos suficientes y
                        sin impedimento legal alguno. Se
                        identifican con los pasaportes n.° <span class="fill-blank">${conditions.passportNumber || "—"}</span>.
                    </td>
                    <td style="border-bottom: none;">and domiciled at <span
                            class="fill-blank">${conditions.tenantAddress || renterProfile?.address || "N/A"}</span> with
                        sufficient financial resources and no legal impediment. Identified with Passport No. <span
                            class="fill-blank">${conditions.passportNumber || "—"}</span>.</td>
                </tr>
                <tr>
                    <td style="border-top: none;"><strong>Correo electrónico:</strong><br><span class="fill-blank">${renterProfile?.email || "—"}</span><br><span class="fill-blank">${conditions.tenantEmail2 || "—"}</span><br><br>
                        <div style="display: flex; align-items: flex-start;">
                            <strong style="white-space: nowrap;">Contacto:</strong>
                            <div style="display: flex; flex-direction: column; margin-left: 5px;">
                                <span class="fill-blank">${renterProfile?.phone_number || "—"}</span>
                            </div>
                        </div>
                    </td>
                    <td style="border-top: none;"><strong>Email Address:</strong><br><span class="fill-blank">${renterProfile?.email || "—"}</span><br><span class="fill-blank">${conditions.tenantEmail2 || "—"}</span><br><br>
                        <div style="display: flex; align-items: flex-start;">
                            <strong style="white-space: nowrap;">Contact:</strong>
                            <div style="display: flex; flex-direction: column; margin-left: 5px;">
                                <span class="fill-blank">${renterProfile?.phone_number || "—"}</span>
                            </div>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td><strong>III. RESPONSABILIDAD:</strong> Se obliga conjunta, solidaria y sin limitación alguna al
                        cumplimiento total de todas las obligaciones derivadas de este contrato.</td>
                    <td><strong>III. RESPONSIBILITY:</strong> Binds herself jointly, severally, and without limitation
                        to the full performance of all obligations arising from this contract.</td>
                </tr>
                <tr>
                    <td><strong>IV. INMUEBLE:</strong> Cuenta con <span
                            class="fill-blank">${conditions.totalBedrooms || listing.bedrooms || "N/A"}</span> dormitorios, <span
                            class="fill-blank">${conditions.totalBathrooms || listing.bathrooms || "N/A"}</span> baños completos y <span
                            class="fill-blank">${conditions.totalRooms || "N/A"} total habitaciones</span>. Libre de adeudos y gravámenes.</td>
                    <td><strong>IV. PROPERTY:</strong> Featuring <span
                            class="fill-blank">${conditions.totalBedrooms || listing.bedrooms || "N/A"}</span> bedrooms, <span
                            class="fill-blank">${conditions.totalBathrooms || listing.bathrooms || "N/A"}</span>full bathrooms, and <span
                            class="fill-blank">${conditions.totalRooms || "N/A"} total rooms</span>. Delivered free of debts and liens.
                    </td>
                </tr>
                <tr class="section-header">
                    <td>CLÁUSULAS</td>
                    <td>CLAUSES</td>
                </tr>
                <tr>
                    <td><strong>1. DESTINO DEL INMUEBLE:</strong> Exclusivamente para casa habitación.</td>
                    <td><strong>1. USE OF PROPERTY:</strong> Solely for dwelling purposes.</td>
                </tr>
                <tr>
                    <td><strong>2. TÉRMINO:</strong> <span class="fill-blank">${conditions.leaseDuration || booking.lease_duration_months || 12} meses</span>, desde el
                        <span class="fill-blank">${conditions.leaseStartDate ? formatDate(conditions.leaseStartDate) : formatDate(leaseStart)}</span> hasta el <span
                            class="fill-blank">${conditions.leaseEndDate ? formatDate(conditions.leaseEndDate) : formatDate(leaseEnd)}</span>.
                    </td>
                    <td><strong>2. TERM:</strong> <span class="fill-blank">${conditions.leaseDuration || booking.lease_duration_months || 12} months</span>, from <span
                            class="fill-blank">${conditions.leaseStartDate ? formatDate(conditions.leaseStartDate) : formatDate(leaseStart)}</span> to <span
                            class="fill-blank">${conditions.leaseEndDate ? formatDate(conditions.leaseEndDate) : formatDate(leaseEnd)}</span>.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 7: AGREEMENT (Clauses 3-5) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="line-height: 1.8;"><strong>3. PRECIO DE RENTA Y PAGOS INICIALES:</strong><br>
                        Renta mensual: $ <span class="fill-blank">${(listing.price_mxn || rentAmount).toLocaleString()} MXN</span><br>
                        Depósito: $ <span class="fill-blank">${(parseFloat(conditions.securityDepositAmount) || depositAmount).toLocaleString()} MXN</span><br>
                        Primer mes: $ <span class="fill-blank">${(parseFloat(conditions.advanceMonthsPayment) || rentAmount).toLocaleString()} MXN</span><br>
                        Último mes: $ <span class="fill-blank">${(parseFloat(conditions.lastMonthRent) || 0).toLocaleString()} MXN</span></td>
                    <td style="line-height: 1.8;"><strong>3. RENT PRICE AND INITIAL PAYMENTS:</strong><br>
                        Monthly rent: $ <span class="fill-blank">${(listing.price_mxn || rentAmount).toLocaleString()} MXN</span><br>
                        Security deposit: $ <span class="fill-blank">${(parseFloat(conditions.securityDepositAmount) || depositAmount).toLocaleString()} MXN</span><br>
                        First month: $ <span class="fill-blank">${(parseFloat(conditions.advanceMonthsPayment) || rentAmount).toLocaleString()} MXN</span><br>
                        Last Month: $ <span class="fill-blank">${(parseFloat(conditions.lastMonthRent) || 0).toLocaleString()} MXN</span></td>
                </tr>
                <tr>
                    <td><strong>4. FORMA Y LUGAR DE PAGO:</strong> El arrendatario pagará el día <span
                            class="fill-blank">${conditions.paymentDate || "1st"}</span> de cada mes, con 2
                        días de gracia. Recargo 5% mensual por retraso. Inventario de mobiliario firmado antes de la
                        posesión.<br><br>
                        <strong>NOMBRE:</strong> <span class="fill-blank">${conditions.bankAccountName || lName}</span><br>
                        <strong>CUENTA:</strong> <span class="fill-blank">${conditions.bankAccountNumber || "—"}</span><br>
                        <strong>SUCURSAL:</strong> <span class="fill-blank">${conditions.branch || "—"}</span><br>
                        <strong>BANCO:</strong> <span class="fill-blank">${conditions.bank || "—"}</span><br>
                        <strong>DIRECCION BANCO:</strong> <span class="fill-blank">${conditions.bankAddress1 || "—"}</span><br>
                        <strong>CLABE:</strong> <span class="fill-blank">${conditions.clabe || "—"}</span><br>
                        <strong>CÓDIGO SWIFT:</strong> <span class="fill-blank">${conditions.swiftCode || "—"}</span><br>
                        <strong>REFERENCIA:</strong> <span class="fill-blank">${conditions.reference || "—"}</span>
                    </td>
                    <td><strong>4. FORM AND PLACE OF PAYMENT:</strong> Tenant will pay by the <span
                            class="fill-blank">${conditions.paymentDate || "1st"}</span> of each month with 2 days of grace. 5%
                        monthly
                        surcharge for late payment. Furniture inventory signed
                        before possession.<br><br>
                        <strong>NAME:</strong> <span class="fill-blank">${conditions.bankAccountName || lName}</span><br>
                        <strong>ACCOUNT:</strong> <span class="fill-blank">${conditions.bankAccountNumber || "—"}</span><br>
                        <strong>BRANCH:</strong> <span class="fill-blank">${conditions.branch || "—"}</span><br>
                        <strong>BANK:</strong> <span class="fill-blank">${conditions.bank || "—"}</span><br>
                        <strong>BANK ADDRESS:</strong> <span class="fill-blank">${conditions.bankAddress1 || "—"}</span><br>
                        <strong>CLABE:</strong> <span class="fill-blank">${conditions.clabe || "—"}</span><br>
                        <strong>SWIFT CODE:</strong> <span class="fill-blank">${conditions.swiftCode || "—"}</span><br>
                        <strong>REFERENCE:</strong> <span class="fill-blank">${conditions.reference || "—"}</span>
                    </td>
                </tr>
                <tr>
                    <td><strong>5. DEPÓSITO DE SEGURIDAD:</strong> Equivalente a una mensualidad. Inspección en 5 días
                        hábiles tras desocupación. Devolución sujeta a deducciones por daños o cuentas impagadas.</td>
                    <td><strong>5. SECURITY DEPOSIT:</strong> Equivalent to one month's rent. Inspection within 5
                        business days after vacating. Return subject to deductions for damages or unpaid accounts.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 8: AGREEMENT (Clauses 6-9) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>6. RESCISIÓN DEL CONTRATO:</strong> El arrendador podrá rescindir este contrato y
                        retener el monto remanente de la renta y el depósito de seguridad, en caso de incumplimiento por
                        causas imputables al arrendatario, quedando ambas partes liberadas de cualquier reclamación
                        futura.</td>
                    <td><strong>6. RESCISSION OF THE CONTRACT:</strong> The landlord may rescind this contract and
                        retain the remaining amount of rent and the security deposit, in case of noncompliance
                        attributable to the tenant, with both parties released from any future claims.</td>
                </tr>
                <tr>
                    <td><strong>7. ENTREGA Y RECEPCIÓN:</strong> El arrendador hace entrega material del inmueble. El
                        arrendatario declara que lo recibe en perfectas condiciones y se compromete a devolverlo en el
                        mismo estado, manteniendo instalaciones y reponiendo bienes dañados. Renuncia expresamente a lo
                        establecido por el artículo 1995 fracción II del Código Civil del Estado de Jalisco.</td>
                    <td><strong>7. DELIVERY AND RECEPTION:</strong> The landlord makes material delivery of the
                        property. The tenant declares that they receive it in perfect condition and commit to return it
                        in the same state, maintaining installations and replacing damaged goods. They expressly waive
                        what is established by Article 1995 Section II of the Civil Code of the State of Jalisco.</td>
                </tr>
                <tr>
                    <td><strong>8. INSTALACIONES Y ADECUACIONES:</strong> Reparaciones mayores (filtraciones, humedades,
                        electrodomésticos y daños no imputables al arrendatario) serán a cargo del arrendador. El
                        arrendatario no podrá hacer variaciones ni mejoras sin permiso previo.</td>
                    <td><strong>8. INSTALACIONES AND MODIFICATIONS:</strong> Major repairs (leaks, moisture, appliances,
                        and damages not attributable to the tenant) shall be the responsibility of the landlord. The
                        tenant may not make alterations or improvements without prior consent.</td>
                </tr>
                <tr>
                    <td><strong>9. SUSTANCIAS PELIGROSAS:</strong> Prohibido guardar productos ilícitos o usar el
                        inmueble como bodega. Prohibido usar sustancias ilícitas, inflamables o explosivas. La violación
                        será causa de rescisión.</td>
                    <td><strong>9. HAZARDOUS SUBSTANCES:</strong> Forbidden to store illicit products or use the
                        property as a warehouse. Forbidden to use illicit, flammable, or explosive substances. Violation
                        shall be cause for rescission.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 9: AGREEMENT (Clauses 10-11 Part A) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>10. OBLIGACIONES DEL ARRENDATARIO:</strong> I. Pagar la renta en tiempo y forma. II.
                        Responder por daños causados por culpa o negligencia. III. Usar el inmueble solo para el destino
                        convenido. IV. Informar al arrendador de reparaciones mayores. V. Informar al arrendador de
                        usurpaciones o daños de terceros. VI. El Arrendatario se compromete a cumplir con todas las
                        normas, reglamentos, estatutos y políticas de la Asociación de Propietarios de Condominios
                        ("APO"), según se modifiquen periódicamente. El Arrendatario deberá asegurarse de que todos los
                        ocupantes, invitados y visitantes también cumplan con dichas normas y reglamentos. Cualquier
                        multa, sanción, daño o costo que resulte del incumplimiento por parte del Arrendatario, sus
                        ocupantes o invitados será responsabilidad exclusiva del Arrendatario. Las infracciones
                        reiteradas o graves de las normas de la Asociación de Propietarios de Condominios constituirán
                        un incumplimiento de este Contrato de Arrendamiento y podrán ser motivo de rescisión conforme a
                        la legislación mexicana aplicable.</td>
                    <td><strong>10. TENANT OBLIGATIONS:</strong> I. Pay rent on time and in the agreed form. II. Be
                        responsible for damages caused by fault or negligence. III. Use the property only for the agreed
                        purpose. IV. Inform the landlord of major repairs. V. Inform the landlord of usurpations or
                        damages caused by third parties. VI. The Tenant agrees to comply with and abide by all rules,
                        regulations, bylaws, and policies of the Condominium/Homeowners' Association ("HOA"), as amended
                        from time to time. The Tenant shall ensure that all occupants, guests, visitors, and invitees
                        also comply with such rules and regulations. Any fines, penalties, damages, or costs resulting
                        from the Tenant's or their occupants' or guests' failure to comply shall be the sole
                        responsibility of the Tenant. Repeated or material violations of the Condominium/Homeowners'
                        Association rules shall constitute a breach of this Lease and may be grounds for termination in
                        accordance with applicable Mexican law.</td>
                </tr>
                <tr>
                    <td><strong>11. RESPONSABILIDAD DEL ARRENDADOR Y ARRENDATARIO:</strong> Durante la vigencia del
                        contrato, el inmueble deberá mantenerse en condiciones adecuadas para su uso pacífico. El
                        arrendatario cubrirá reparaciones derivadas de...</td>
                    <td><strong>11. RESPONSIBILITY OF LANDLORD AND TENANT:</strong> During the term of the contract, the
                        property must be maintained in suitable condition for peaceful use. The tenant shall cover
                        repairs due to...</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 10: AGREEMENT (Clauses 11 Part B - 14) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>...uso indebido o negligencia. El arrendador cubrirá reparaciones por desgaste natural, vicios
                        ocultos o fallas estructurales, y realizará mantenimiento preventivo de aire acondicionado cada
                        seis meses. El arrendador pagará la cuota de condóminos; el arrendatario pagará luz, agua y gas.
                    </td>
                    <td>...natural wear, hidden defects, or structural failures, and shall perform preventive
                        maintenance of air conditioning every six months. The landlord pays condominium fees; the tenant
                        pays electricity, water, and gas.</td>
                </tr>
                <tr>
                    <td><strong>12. PROTECCIÓN CONTRA EXTINCIÓN DE DOMINIO:</strong> El inmueble deberá destinarse
                        exclusivamente a casa habitación. Si una autoridad determina que el arrendatario lo usó para
                        actividades ilícitas, será responsable de daños comprobables. El arrendatario no será
                        responsable si demuestra que no tuvo conocimiento ni participación. El contrato podrá
                        rescindirse solo en caso de resolución firme que afecte definitivamente el inmueble.</td>
                    <td><strong>12. EXTINCTION OF DOMAIN PROTECTION:</strong> The property must be used exclusively as a
                        dwelling. If an authority determines that the tenant used it for illicit activities, the tenant
                        will be liable for proven damages. The tenant will not be liable if they prove they had no
                        knowledge or participation. The contract may be rescinded only in case of a firm resolution that
                        definitively affects the property.</td>
                </tr>
                <tr>
                    <td><strong>13. RESPONSABILIDAD DEL ARRENDADOR:</strong> El arrendador no se hace responsable de
                        pérdidas, robo o daños sufridos por el arrendatario en el inmueble o áreas comunes.</td>
                    <td><strong>13. LANDLORD LIABILITY:</strong> The landlord is not responsible for losses, theft, or
                        damages suffered by the tenant in the property or common areas.</td>
                </tr>
                <tr>
                    <td><strong>14. GARANTÍA:</strong> El arrendatario acepta todos los términos y condiciones al
                        firmar. Si incumple, el arrendador podrá retener el depósito de seguridad como penalidad.</td>
                    <td><strong>14. GUARANTEE:</strong> The tenant accepts all terms and conditions upon signing. If
                        they breach, the landlord may retain the security deposit as a penalty.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 11: AGREEMENT (Clauses 15-16) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>15. VIGENCIA:</strong> El contrato tiene una duración de <span
                            class="fill-blank">${conditions.leaseDuration || booking.lease_duration_months || 12} meses</span>, desde el <span
                            class="fill-blank">${conditions.leaseStartDate ? formatDate(conditions.leaseStartDate) : formatDate(leaseStart)}</span> hasta el <span
                            class="fill-blank">${conditions.leaseEndDate ? formatDate(conditions.leaseEndDate) : formatDate(leaseEnd)}</span>. Al finalizar el contrato, el
                        arrendatario deberá devolver
                        la propiedad al arrendador. Renuncia al derecho de prórroga previsto en el artículo 1820 C del
                        Código Civil de Jalisco. Si continúa ocupando el inmueble sin autorización, deberá pagar una
                        renta mensual de &nbsp; $ <span class="fill-blank">${(listing.price_mxn || rentAmount).toLocaleString()} MXN</span> durante
                        el desalojo, sin que el contrato se considere prorrogado.</td>
                    <td><strong>15. TERM:</strong> The contract lasts <span
                            class="fill-blank">${conditions.leaseDuration || booking.lease_duration_months || 12} months</span>, from <span
                            class="fill-blank">${conditions.leaseStartDate ? formatDate(conditions.leaseStartDate) : formatDate(leaseStart)}</span> to <span
                            class="fill-blank">${conditions.leaseEndDate ? formatDate(conditions.leaseEndDate) : formatDate(leaseEnd)}</span>. The tenant shall return the property
                        to the landlord at the end. They waive the right of
                        extension under Article 1820 C of the Civil Code of Jalisco. If they continue occupying without
                        authorization, they shall pay monthly rent of $ <span
                            class="fill-blank">${(listing.price_mxn || rentAmount).toLocaleString()} MXN</span> during eviction proceedings, without
                        the contract being considered extended.</td>
                </tr>
                <tr>
                    <td><strong>16. PENALIDAD:</strong> A) Por retraso en la entrega del inmueble: Si el arrendatario no
                        desocupa voluntariamente al término del contrato, se aplicará una penalidad equivalente al 100%
                        de las rentas debidas durante la vigencia, sin que se entienda prorrogado el contrato. B) Por
                        terminación anticipada: Si el arrendatario termina anticipadamente por causas imputables a él,
                        deberá cubrir una penalización equivalente a un mes de renta. No habrá devolución de rentas
                        adelantadas ni del depósito. Si el arrendador termina anticipadamente por causas imputables a
                        él, deberá devolver íntegramente el depósito, aplicar el último mes de renta pagado y cubrir una
                        compensación equivalente al 20% de una mensualidad. En todos los casos, la parte que desee
                        terminar deberá notificar con 30 días de anticipación.</td>
                    <td><strong>16. PENALTY:</strong> A) For delay in vacating the property: If the tenant does not
                        vacate voluntarily at the end of the contract, a penalty equal to 100% of the rents due during
                        the term shall apply, without the contract being considered extended. B) For early termination:
                        If the tenant terminates early for causes attributable to them, they must pay a penalty equal to
                        one month's rent. No refund of prepaid rent or deposit. If the landlord terminates early for
                        causes attributable to them, they must return the full deposit, apply the last month's rent
                        paid, and cover compensation equal to 20% of one month's rent. In all cases, the party wishing
                        to terminate must notify with 30 days' notice.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 12: AGREEMENT (Clauses 17-20) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>17. RELACIONES CON TERCEROS:</strong> Serán por cuenta del arrendatario los servicios
                        personales o por honorarios contratados para limpieza o conservación del inmueble, excluyendo al
                        arrendador de cualquier relación laboral o de servicios. Máximo <span class="fill-blank">${conditions.personsAllowed || "—"}</span> personas podrán habitar el
                        inmueble.</td>
                    <td><strong>17. RELATIONS WITH THIRD PARTIES:</strong> The tenant shall be responsible for personal
                        or contracted services for cleaning or maintenance of the property, excluding the landlord from
                        any labor or service relationship. A maximum of <span class="fill-blank">${conditions.personsAllowed || "—"}</span> persons may inhabit the property.</td>
                </tr>
                <tr>
                    <td><strong>18. DEVOLUCIÓN DE DEPÓSITO:</strong> Si el arrendatario cumple con todas las
                        obligaciones, el depósito será devuelto una vez desocupado el inmueble y verificado en buen
                        estado, salvo desgaste normal. El arrendador podrá retenerlo hasta 15 días para comprobación o
                        reparaciones necesarias.</td>
                    <td><strong>18. RETURN OF DEPOSIT:</strong> If the tenant fulfills all obligations, the deposit
                        shall be returned once the property is vacated and verified in good condition, except for normal
                        wear. The landlord may retain it up to 15 days for verification or necessary repairs.</td>
                </tr>
                <tr>
                    <td><strong>19. DESALOJO:</strong> El arrendatario acepta desocupar inmediatamente al término del
                        contrato sin necesidad de resolución judicial, salvo que se firme prórroga. El arrendatario
                        deberá notificar al arrendador con al menos 30 días de anticipación la desocupación.</td>
                    <td><strong>19. EVICTION:</strong> The tenant agrees to vacate immediately at the end of the
                        contract without judicial resolution, unless a renewal is signed. The tenant must notify the
                        landlord at least 30 days in advance of vacating.</td>
                </tr>
                <tr>
                    <td><strong>20. CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS:</strong> Ambas partes se comprometen a no
                        divulgar información confidencial obtenida por razón del contrato, salvo lo indispensable para
                        su cumplimiento. Se obligan a cumplir con la Ley Federal de Protección de Datos en Posesión de
                        Particulares, adoptando medidas de seguridad y prohibiendo cesiones sin autorización. Estas
                        obligaciones se mantienen indefinidamente, incluso después de la terminación del contrato.</td>
                    <td><strong>20. CONFIDENTIALITY AND DATA PROTECTION:</strong> Both parties agree not to disclose
                        confidential information obtained by reason of the contract, except as necessary for compliance.
                        They are obliged to comply with the Federal Law on Protection of Personal Data Held by Private
                        Parties, adopting security measures and transfers without authorization. These obligations
                        remain indefinitely, even after termination of the contract.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 13: AGREEMENT (Clauses 21-23) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>21. TRADUCCIÓN:</strong> Los subtítulos de las cláusulas se han insertado únicamente
                        para facilitar la lectura y manejo, y no deberán considerarse como limitación para la
                        interpretación o cumplimiento de las obligaciones. La versión en inglés es solo una traducción
                        de cortesía; para todos los efectos legales prevalecerá la versión en español.</td>
                    <td><strong>21. TRANSLATION:</strong> The subtitles of the clauses have been inserted solely to
                        facilitate reading and handling, and shall not be considered as a limitation for interpretation
                        or compliance. The English version is only a courtesy translation; for all legal purposes, the
                        Spanish version shall prevail.</td>
                </tr>
                <tr>
                    <td><strong>22. ACEPTACIÓN DE LAS CLÁUSULAS:</strong> Ambas partes declaran conocer y aceptar todas
                        las normas legales citadas en el contrato, en especial aquellas cuyos beneficios renuncian
                        expresamente. Tras la lectura, firman ante testigos en Puerto Vallarta, Jalisco.</td>
                    <td><strong>22. ACCEPTANCE OF CLAUSES:</strong> Both parties declare that they know and accept all
                        legal provisions cited in the contract, especially those whose benefits they expressly waive.
                        After reading, they sign before witnesses in Puerto Vallarta, Jalisco.</td>
                </tr>
                <tr>
                    <td><strong>23. INCREMENTO DE RENTA ANUAL:</strong> De conformidad con el artículo 2448D del Código
                        Civil Federal, el monto de la renta podrá actualizarse una vez al año. Se estipula un incremento
                        del 6%. CLÁUSULA DE TERMINACIÓN ANTICIPADA: En caso de no encontrarse en los supuestos
                        previstos, se aplicará lo establecido en la cláusula de penalidad.</td>
                    <td><strong>23. ANNUAL RENT INCREASE:</strong> In accordance with Article 2448D of the Federal Civil
                        Code, the rent amount may be updated once a year. A 6% increase is stipulated. EARLY TERMINATION
                        CLAUSE: If not within the stipulated cases, the penalty clause shall apply.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 14: AGREEMENT (Clause 24, Jurisdiction, Special Clause) -->
    <div class="page">
        <table class="bilingual-table">
            <thead>
                <tr class="section-title">
                    <th>CONTRATO DE ARRENDAMIENTO <br>&nbsp;</th>
                    <th>LEASE AGREEMENT <br>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>24. DERECHO DE TANTO Y OPCIÓN DE COMPRA:</strong> En caso de que “EL ARRENDADOR” desee
                        vender el inmueble o “EL ARRENDATARIO” manifieste interés en comprarlo, “EL ARRENDATARIO” tendrá
                        el derecho de preferencia (derecho de tanto) para adquirirlo en las mismas condiciones ofrecidas
                        a terceros. “EL ARRENDADOR” notificará por escrito a “EL ARRENDATARIO” su intención de venta,
                        incluyendo el precio y condiciones. A partir de dicha notificación, “EL ARRENDATARIO” contará
                        con un plazo de setenta y dos (72) horas para responder. La transacción será negociada por el
                        agente inmobiliario interviniente, quien tendrá derecho a recibir la comisión correspondiente
                        como en una compraventa normal de inmueble.</td>
                    <td><strong>24. RIGHT OF FIRST REFUSAL AND PURCHASE OPTION:</strong> In the event that “THE
                        LANDLORD” wishes to sell the property or “THE TENANT” expresses interest in buying it, “THE
                        TENANT” shall have the right of first refusal to purchase under the same conditions offered to
                        third parties. “THE LANDLORD” shall notify “THE TENANT” in writing of the intention to sell,
                        including price and terms. From the date of such notice, “THE TENANT” shall have seventy-two
                        (72) hours to respond. The transaction shall be negotiated by the real estate agent involved,
                        who shall be entitled to the commission as in a normal property sale.</td>
                </tr>
                <tr>
                    <td><strong>JURISDICCIÓN Y COMPETENCIA:</strong> Para la interpretación y cumplimiento del contrato,
                        las partes se someten a los tribunales de Puerto Vallarta, Jalisco, renunciando al fuero de sus
                        domicilios presentes o futuros.</td>
                    <td><strong>JURISDICTION AND COMPETENCE:</strong> For interpretation and compliance, the parties
                        submit to the courts of Puerto Vallarta, Jalisco, waiving jurisdiction of their present or
                        future domiciles.</td>
                </tr>
                <tr>
                    <td><strong>CLÁUSULA ESPECIAL – CONDICIONES PARTICULARES:</strong> 1.) El propietario acepta que la
                        vivienda se entregue antes de lo previsto, el <span class="fill-blank">${conditions.earlyMoveOnDate ? formatDate(conditions.earlyMoveOnDate) : "N/A"}</span>, sin coste adicional. 2.) El
                        servicio de internet <span class="fill-blank">${conditions.internetIncluded ? "incluido" : "no incluido"}</span> en el alquiler.
                    </td>
                    <td><strong>SPECIAL CLAUSE – SPECIAL CONDITIONS:</strong> 1.) The Landlord agrees to an early
                        move-in, on the <span class="fill-blank">${conditions.earlyMoveOnDate ? formatDate(conditions.earlyMoveOnDate) : "N/A"}</span>, at no
                        additional charge. 2.) Internet will <span class="fill-blank">${conditions.internetIncluded ? "be included" : "not be included"}</span> in the rental.</td>
                </tr>
            </tbody>
        </table>
        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

    <!-- PAGE 15: SIGNATURES -->
    <div class="page">
        <div class="signatures-title">Firmas / Signatures</div>

        <div class="sig-grid">
            <div class="sig-block">
                <div class="sig-label">EL ARRENDADOR / THE LANDLORD:</div>
                ${landlordSignatureUrl ? `<img class="sig-image" src="${landlordSignatureUrl}" />` : ''}
                <div style="color: white; font-size: 1px; height: 1px; overflow: hidden;">/LandlordSign/</div>
                <div class="sig-line"></div>
                <div class="sig-name">${lName}</div>
                <div class="sig-name">${formatSignatureDate(conditions.landlordSignatureDate)}</div>
            </div>

            <div class="sig-block">
                <div class="sig-label">EL ARRENDATARIO / THE TENANT:</div>
                ${tenantSignatureUrl ? `<img class="sig-image" src="${tenantSignatureUrl}" />` : ''}
                <div style="color: white; font-size: 1px; height: 1px; overflow: hidden;">/TenantSign/</div>
                <div class="sig-line"></div>
                <div class="sig-name">${tName}</div>
                <div class="sig-name">${formatSignatureDate(tenantSignatureDate || conditions.tenantSignatureDate)}</div>
            </div>

            ${agentProfile ? `
            <div class="sig-block" style="margin-top: 20px;">
                <div class="sig-label">AGENTE / AGENT:</div>
                ${agentSignatureUrl ? `<img class="sig-image" src="${agentSignatureUrl}" />` : ''}
                <div style="color: white; font-size: 1px; height: 1px; overflow: hidden;">/AgentSign/</div>
                <div class="sig-line"></div>
                <div class="sig-name">${agentProfile.full_name || 'Agent'}</div>
                <div class="sig-name">${formatSignatureDate(agentSignatureDate || conditions.agentSignatureDate)}</div>
            </div>
            ` : ''}
        </div>

        <div class="page-footer-initials">
            <span>Inicial/Initial: ________________________</span>
            <span>Inicial/Initial: ________________________</span>
        </div>
    </div>

</body>

</html>`;

        // 5. Render HTML to PDF via Gotenberg HTML-to-PDF REST API
        const formData = new FormData();
        formData.append("files", new Blob([htmlTemplate], { type: "text/html" }), "index.html");

        // Set custom print options
        formData.append("paperWidth", "8.27"); // A4 width in inches
        formData.append("paperHeight", "11.69"); // A4 height in inches
        formData.append("marginTop", "0.39"); // 10mm margin
        formData.append("marginBottom", "0.39");
        formData.append("marginLeft", "0.39");
        formData.append("marginRight", "0.39");

        // Using a resilient public Gotenberg conversion endpoint with a primary and fallback check
        let response;
        try {
            response = await fetch("https://demo.gotenberg.dev/forms/chromium/convert/html", {
                method: "POST",
                body: formData
            });
            if (!response.ok) {
                throw new Error("Primary failed");
            }
        } catch (e) {
            console.warn("[Gotenberg fallback] Primary endpoint failed, trying backup endpoint...");
            // Use another instance/mirror as backup if the demo instance is down/throwing 502
            response = await fetch("https://gotenberg.demo.kestra.io/forms/chromium/convert/html", {
                method: "POST",
                body: formData
            });
        }

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to render PDF via Gotenberg: ${errText}`);
        }

        const pdfBuffer = await response.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);

        // 6. Upload PDF to MLS Bucket
        const fileName = `leases/${bookingId}-lease-${Date.now()}.pdf`;

        if (booking.lease_pdf_url) {
            const oldFileName = booking.lease_pdf_url.split('/').pop();
            if (oldFileName) {
                try {
                    await supabaseAdmin.storage.from("MLS").remove([`leases/${oldFileName}`]);
                } catch (err) {
                    console.warn("[PDF Gen] Could not delete old PDF:", err);
                }
            }
        }

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from("MLS")
            .upload(fileName, pdfBytes, {
                contentType: "application/pdf",
                upsert: true
            });

        if (uploadError) {
            console.error("[PDF Gen] Upload to MLS bucket failed:", uploadError);
            throw new Error(`Failed to upload lease PDF: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = await supabaseAdmin
            .storage
            .from("MLS")
            .getPublicUrl(fileName);

        // 7. Update booking
        const newLeaseStatus = tenantSignatureUrl ? "signed" : "generated";
        const { error: updateError } = await supabaseAdmin
            .from("bookings")
            .update({
                lease_pdf_url: publicUrl,
                lease_status: newLeaseStatus,
                status: tenantSignatureUrl ? "approved" : "lease_pending",
                agreement_conditions: {
                    ...conditions,
                    landlordSignature: landlordSignatureUrl,
                    landlordSignatureDate: formatSignatureDate(conditions.landlordSignatureDate),
                    tenantSignature: tenantSignatureUrl,
                    tenantSignatureDate: formatSignatureDate(tenantSignatureDate || conditions.tenantSignatureDate),
                    agentSignature: agentSignatureUrl,
                    agentSignatureDate: formatSignatureDate(conditions.agentSignatureDate || agentSignatureDate)
                }
            })
            .eq("id", bookingId);

        if (updateError) {
            console.error("[PDF Gen] Supabase Update Error:", updateError);
            throw new Error("Failed to update booking with lease URL.");
        }

        return new Response(JSON.stringify({
            success: true,
            lease_pdf_url: publicUrl,
            status: "lease_generated"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("PDF generation error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
