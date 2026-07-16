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
    const anvilApiKey = Deno.env.get("ANVIL_API_KEY") || "";

    if (!anvilApiKey) {
      throw new Error("ANVIL_API_KEY is missing from environment variables.");
    }

    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { bookingId, agreementConditions, tenantSignature, tenantSignatureDate } = await req.json();

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

    // 3. Fetch Renter and Owner Profiles using service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || supabaseAnonKey
    );

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

    if (!renterProfile?.email || !ownerProfile?.email) {
      throw new Error("Renter or Owner email not found");
    }

    // Use agreementConditions if provided, otherwise merge with existing booking agreement_conditions to prevent overwriting
    const conditions = {
      ...(booking.agreement_conditions || {}),
      ...(agreementConditions || {})
    };

    // 4. Upload signatures to Supabase Storage
    const uploadSignature = async (signatureDataUrl: string, fileName: string) => {
      if (!signatureDataUrl) return null;
      try {
        // Convert base64 data URL to blob
        const base64Data = signatureDataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });

        const filePath = `signatures/${bookingId}-${fileName}-${Date.now()}.png`;

        // Use service role key for upload (required for storage operations)
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!serviceRoleKey) {
          console.error("[anvil] SUPABASE_SERVICE_ROLE_KEY not found in secrets");
          return null;
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        const { error: uploadError } = await supabaseAdmin
          .storage
          .from("MLS")
          .upload(filePath, blob, {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) {
          console.error(`[anvil] Upload failed:`, uploadError);
          return null;
        }

        const { data: { publicUrl } } = await supabaseAdmin
          .storage
          .from("MLS")
          .getPublicUrl(filePath);

        console.log(`[anvil] Uploaded ${fileName} to ${publicUrl}`);
        return publicUrl;
      } catch (err) {
        console.error(`[anvil] Failed to upload ${fileName}:`, err);
        return null;
      }
    };

    // Upload landlord signature if provided (on first call or if still base64)
    let landlordSignatureUrl = conditions.landlordSignature;
    if (conditions.landlordSignature && !landlordSignatureUrl?.startsWith('http')) {
      landlordSignatureUrl = await uploadSignature(conditions.landlordSignature, 'landlord');
    }

    // Upload tenant signature if provided
    let tenantSignatureUrl = tenantSignature;
    if (tenantSignature && !tenantSignature.startsWith('http')) {
      tenantSignatureUrl = await uploadSignature(tenantSignature, 'tenant');
    }

    // 5. Fill the PDF template using Anvil Fill PDF API
    const pdfTemplateId = "OQX8J8rLtRn0jpj9mwNn";
    const rentAmount = listing.price_usd || 0;
    const depositAmount = listing.deposit_amount || 0;
    const leaseStart = booking.move_in_date || new Date().toISOString().split("T")[0];
    const leaseEnd = new Date(new Date(leaseStart).getTime() + (booking.lease_duration_months || 12) * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Helper to format date as "25 Dec, 2026"
    const formatDate = (dateStr: string | Date) => {
      const d = new Date(dateStr);
      const day = d.getDate();
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const year = d.getFullYear();
      return `${day} ${month}, ${year}`;
    };

    // Format signature dates as "12 Dec, 2026" format for text fields
    const formatSignatureDate = (dateStr: string | undefined | null) => {
      if (!dateStr) return "";
      // If already formatted (contains a comma), return as-is
      if (dateStr.includes(',')) return dateStr;
      try {
        // Extract just the date part if it's an ISO datetime string
        const datePart = dateStr.split('T')[0];
        const d = new Date(datePart + 'T00:00:00');
        if (isNaN(d.getTime())) return "";
        const day = d.getDate();
        const month = d.toLocaleDateString("en-US", { month: "short" });
        const year = d.getFullYear();
        return `${day} ${month}, ${year}`;
      } catch (err) {
        console.error(`[anvil] Error formatting date:`, dateStr, err);
        return "";
      }
    };

    const mark = (value: boolean) => (value ? "✓" : "✗");

    const fillData = {
      title: `Lease Agreement - ${listing.title}`,
      fontFamily: "Helvetica",
      fontSize: 8,
      textColor: "#000000",
      useInteractiveFields: false,
      data: {
        landlordName: conditions.landlordName || ownerProfile.full_name || ownerProfile.email || "Owner",
        tenantName: conditions.tenantName || renterProfile.full_name || renterProfile.email || "Renter",
        totalRooms: conditions.totalRooms || listing.bedrooms || listing.total_rooms || "N/A",
        totalBedrooms: conditions.totalBedrooms || listing.bedrooms || "N/A",
        totalBathrooms: conditions.totalBathrooms || listing.bathrooms || "N/A",
        propertyAddress: conditions.propertyAddress || listing.address || "",
        propertyCity: conditions.propertyCity || listing.city || "",
        propertyState: conditions.propertyState || listing.state || "",
        propertyUnit: conditions.propertyUnit || listing.unit || "",
        leaseStartDate: conditions.leaseStartDate || formatDate(leaseStart),
        leaseDuration: conditions.leaseDuration || `${booking.lease_duration_months || 12} months`,
        leaseEndDate: conditions.leaseEndDate || formatDate(leaseEnd),
        monthlyRent: conditions.monthlyRent || `$${rentAmount.toFixed(2)}`,
        rentDueDateDay: conditions.rentDueDateDay || "1",
        lateFee: conditions.lateFee || "N/A",
        gracePeriodDays: conditions.gracePeriodDays || "5",
        paymentMethod: conditions.paymentMethod || "Bank Transfer",
        securityDepositAmount: conditions.securityDepositAmount || depositAmount.toFixed(2),

        fullyFurnished: mark(conditions.fullyFurnished),
        semiFurnished: mark(conditions.semiFurnished),
        unFurnished: mark(conditions.unFurnished),
        petFriendly: mark(conditions.petFriendly),
        noPetsAllowed: mark(conditions.noPetsAllowed),
        petsNegotiable: mark(conditions.petsNegotiable),

        ParkingAvailable: mark(conditions.ParkingAvailable),
        balconyTerrace: mark(conditions.balconyTerrace),
        gardenYard: mark(conditions.gardenYard),
        centralAC: mark(conditions.centralAC),
        heatingIncluded: mark(conditions.heatingIncluded),
        waterIncluded: mark(conditions.waterIncluded),
        electricityIncluded: mark(conditions.electricityIncluded),
        gasIncluded: mark(conditions.gasIncluded),
        internetIncluded: mark(conditions.internetIncluded),
        trashSewageIncluded: mark(conditions.trashSewageIncluded),
        otherUtilitiesIncluded: mark(conditions.otherUtilitiesIncluded),
        UtilitiesIncluded: mark(conditions.UtilitiesIncluded),
        emergencyContact: conditions.emergencyContact || "",
        emergencyResponseTimeHours: conditions.emergencyResponseTimeHours || "",
        additionalTermsConditions: conditions.additionalTermsConditions || "",
        landlordSignature: landlordSignatureUrl || "",
        landlordSignatureDate: formatSignatureDate(conditions.landlordSignatureDate),
        tenantSignature: tenantSignatureUrl || "",
        tenantSignatureDate: formatSignatureDate(tenantSignatureDate)
      }
    };

    console.log(`[anvil] Filling PDF template ${pdfTemplateId} for booking ${bookingId}`);
    console.log(fillData, '00000000000000000000000')

    const fillResponse = await fetch(`https://app.useanvil.com/api/v1/fill/${pdfTemplateId}.pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${anvilApiKey}:`)}`
      },
      body: JSON.stringify(fillData),
    });

    if (!fillResponse.ok) {
      const errText = await fillResponse.text();
      console.error("[anvil] Fill PDF API error:", fillResponse.status, errText);
      throw new Error(`Failed to fill PDF template: ${fillResponse.status} ${errText}`);
    }

    // 6. Delete old PDF from bucket if updating
    if (tenantSignature && booking.lease_pdf_url) {
      try {
        const oldFileName = booking.lease_pdf_url.split('/').pop();
        if (oldFileName) {
          await supabaseAdmin.storage.from("MLS").remove([`leases/${oldFileName}`]);
          console.log(`[anvil] Deleted old PDF: ${oldFileName}`);
        }
      } catch (err) {
        console.warn("[anvil] Could not delete old PDF:", err);
      }
    }

    // 7. Upload the filled PDF to Supabase Storage
    const pdfBytes = await fillResponse.arrayBuffer();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const fileName = `leases/${bookingId}-${timestamp}-lease-agreement.pdf`;

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from("MLS")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) {
      console.error("[anvil] Upload to MLS bucket failed:", uploadError);
      throw new Error(`Failed to upload lease PDF: ${uploadError.message}`);
    }

    // Get public URL from MLS bucket
    const { data: { publicUrl } } = await supabaseAdmin
      .storage
      .from("MLS")
      .getPublicUrl(fileName);

    // 8. Update booking with lease info
    const newLeaseStatus = tenantSignature ? "signed" : "generated";
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        lease_pdf_url: publicUrl,
        lease_status: newLeaseStatus,
        status: tenantSignature ? "approved" : "lease_pending",
        agreement_conditions: {
          ...conditions,
          landlordSignature: landlordSignatureUrl,
          tenantSignature: tenantSignatureUrl,
          landlordSignatureDate: formatSignatureDate(conditions.landlordSignatureDate),
          tenantSignatureDate: formatSignatureDate(tenantSignatureDate)
        }
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("[anvil] Supabase Update Error:", updateError);
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
    console.error("Anvil Send Lease Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});