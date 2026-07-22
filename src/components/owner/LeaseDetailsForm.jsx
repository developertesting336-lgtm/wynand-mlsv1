import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { storageIntegration } from '@/lib/auth';

export default function LeaseDetailsForm({ 
  booking, 
  listing, 
  ownerProfile, 
  renterProfile, 
  onSubmit, 
  onCancel, 
  onChange = () => {},
  isSubmitting,
  initialData,
  hideSubmitButton = false,
}) {
  // Determine if this is an edit (initialData provided) or a new form
  const isEdit = !!initialData;

  const getInitialValue = (field, defaultValue) => {
    if (initialData && initialData[field] !== undefined && initialData[field] !== null) {
      return initialData[field];
    }
    return defaultValue;
  };

  const buildInitialFormData = () => ({
    landlordName: getInitialValue('landlordName', ownerProfile?.full_name || ''),
    tenantName: getInitialValue('tenantName', renterProfile?.full_name || ''),
    totalRooms: getInitialValue('totalRooms', listing?.total_rooms || listing?.bedrooms || ''),
    totalBedrooms: getInitialValue('totalBedrooms', listing?.bedrooms || ''),
    totalBathrooms: getInitialValue('totalBathrooms', listing?.bathrooms || ''),
    leaseStartDate: getInitialValue('leaseStartDate', booking?.move_in_date || ''),
    leaseDuration: getInitialValue('leaseDuration', booking?.lease_duration_months || 12),
    leaseEndDate: getInitialValue('leaseEndDate', ''),
    monthlyRent: getInitialValue('monthlyRent', listing?.price_mxn || listing?.price_usd || ''),
    rentDueDateDay: getInitialValue('rentDueDateDay', '1'),
    lateFee: getInitialValue('lateFee', ''),
    gracePeriodDays: getInitialValue('gracePeriodDays', '5'),
    paymentMethod: getInitialValue('paymentMethod', 'Bank Transfer'),
    securityDepositAmount: getInitialValue('securityDepositAmount', listing?.deposit_amount || ''),
    propertyFurnishingType: getInitialValue('propertyFurnishingType', 'Unfurnished'),
    petPolicy: getInitialValue('petPolicy', 'No Pets Allowed'),
    fullyFurnished: getInitialValue('fullyFurnished', false),
    semiFurnished: getInitialValue('semiFurnished', false),
    unFurnished: getInitialValue('unFurnished', true),
    petFriendly: getInitialValue('petFriendly', false),
    noPetsAllowed: getInitialValue('noPetsAllowed', true),
    petsNegotiable: getInitialValue('petsNegotiable', false),
    otherUtilitiesIncluded: getInitialValue('otherUtilitiesIncluded', false),
    ParkingAvailable: getInitialValue('ParkingAvailable', false),
    balconyTerrace: getInitialValue('balconyTerrace', false),
    gardenYard: getInitialValue('gardenYard', false),
    centralAC: getInitialValue('centralAC', false),
    heatingIncluded: getInitialValue('heatingIncluded', false),
    utilitiesIncluded: getInitialValue('utilitiesIncluded', false),
    waterIncluded: getInitialValue('waterIncluded', false),
    electricityIncluded: getInitialValue('electricityIncluded', false),
    electricityUtilityIncluded: getInitialValue('electricityUtilityIncluded', false),
    waterUtilityIncluded: getInitialValue('waterUtilityIncluded', false),
    gasIncluded: getInitialValue('gasIncluded', false),
    gasUtilityIncluded: getInitialValue('gasUtilityIncluded', false),
    internetIncluded: getInitialValue('internetIncluded', false),
    internetUtilityIncluded: getInitialValue('internetUtilityIncluded', false),
    trashSewageIncluded: getInitialValue('trashSewageIncluded', false),
    trashSewageUtilityIncluded: getInitialValue('trashSewageUtilityIncluded', false),
    otherUtilityIncluded: getInitialValue('otherUtilityIncluded', false),
    otherUtilityIncluded1: getInitialValue('otherUtilityIncluded1', false),
    emergencyContact: getInitialValue('emergencyContact', ''),
    emergencyResponseTimeHours: getInitialValue('emergencyResponseTimeHours', ''),
    additionalTermsConditions: getInitialValue('additionalTermsConditions', ''),
    propertyAddress: getInitialValue('propertyAddress', parsedAddress.address),
    propertyCity: getInitialValue('propertyCity', parsedAddress.city),
    propertyState: getInitialValue('propertyState', parsedAddress.state),
    propertyUnit: getInitialValue('propertyUnit', listing?.unit || ''),
    landlordSignature: getInitialValue('landlordSignature', ''),
    owner_docs: getInitialValue('owner_docs', []),
  });

  // Parse address if it exists to prefill city and state
  const getParsedAddressInfo = () => {
    const address = listing?.address || '';
    let city = listing?.city || '';
    let state = listing?.state || '';

    if (address && (!city || !state)) {
      const parts = address.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        state = parts[parts.length - 1] || '';
        city = parts[parts.length - 2] || '';
      } else if (parts.length === 2) {
        state = parts[1] || '';
        city = parts[0] || '';
      }
    }
    return { address, city, state };
  };

  const parsedAddress = getParsedAddressInfo();

  const [formData, setFormData] = useState(buildInitialFormData());

  useEffect(() => {
    setFormData(buildInitialFormData());
  }, [initialData, ownerProfile?.full_name, renterProfile?.full_name, listing?.total_rooms, listing?.bedrooms, listing?.bathrooms, listing?.price_mxn, listing?.price_usd, listing?.deposit_amount, listing?.unit, booking?.move_in_date, booking?.lease_duration_months, parsedAddress.address, parsedAddress.city, parsedAddress.state]);

  const handleChange = (field, value) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    onChange(next);
  };

  const handleDocumentUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const maxSize = 30 * 1024 * 1024;
    const overLimit = files.find((file) => file.size > maxSize);
    if (overLimit) {
      toast.error('Each document must be 30 MB or smaller.');
      return;
    }

    try {
      const uploadedUrls = [];
      for (const file of files) {
        const result = await storageIntegration.UploadFile({ file, folder: 'LeaseDocuments' });
        if (result?.file_url) {
          uploadedUrls.push(result.file_url);
        }
      }
      const next = {
        ...formData,
        owner_docs: [...(formData.owner_docs || []), ...uploadedUrls],
      };
      setFormData(next);
      onChange(next);
      toast.success('Owner documents uploaded');
    } catch (err) {
      console.error('Failed to upload owner documents:', err);
      toast.error('Failed to upload documents. Please try again.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.propertyCity || !formData.propertyCity.trim()) {
      toast.error('City is required.');
      return;
    }
    if (!formData.propertyState || !formData.propertyState.trim()) {
      toast.error('State is required.');
      return;
    }
    if (!formData.propertyUnit || !formData.propertyUnit.trim()) {
      toast.error('Unit number is required.');
      return;
    }

    // Transform radio selections into boolean fields for PDF
    const transformedData = {
      ...formData,
      fullyFurnished: formData.propertyFurnishingType === 'Fully Furnished',
      semiFurnished: formData.propertyFurnishingType === 'Semi-Furnished',
      unFurnished: formData.propertyFurnishingType === 'Unfurnished',
      petFriendly: formData.petPolicy === 'Pet Friendly',
      noPetsAllowed: formData.petPolicy === 'No Pets Allowed',
      petsNegotiable: formData.petPolicy === 'Pets Negotiable',
      otherUtilitiesIncluded: formData.otherUtilitiesIncluded === undefined ? formData.otherUtilityIncluded : formData.otherUtilitiesIncluded,
      landlordSignatureDate: new Date().toISOString()
    };
    onSubmit(transformedData);
  };

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="text-lg">Lease Agreement Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Parties Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">1. The Parties</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="landlordName">Landlord/Owner Name</Label>
                <Input id="landlordName" value={formData.landlordName} readOnly className="bg-muted" />
              </div>
              <div>
                <Label htmlFor="tenantName">Tenant/Renter Name</Label>
                <Input id="tenantName" value={formData.tenantName} readOnly className="bg-muted" />
              </div>
            </div>
          </div>

          {/* Property Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">2. The Property</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="totalRooms">Total Rooms</Label>
                <Input id="totalRooms" type="number" value={formData.totalRooms} onChange={(e) => handleChange('totalRooms', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="totalBedrooms">Total Bedrooms</Label>
                <Input id="totalBedrooms" type="number" value={formData.totalBedrooms} onChange={(e) => handleChange('totalBedrooms', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="totalBathrooms">Total Bathrooms</Label>
                <Input id="totalBathrooms" type="number" value={formData.totalBathrooms} onChange={(e) => handleChange('totalBathrooms', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div className="md:col-span-3">
                <Label htmlFor="propertyAddress">Property Address</Label>
                <Input id="propertyAddress" value={formData.propertyAddress} onChange={(e) => handleChange('propertyAddress', e.target.value)} placeholder="e.g., 123 Main Street, Apt 4B" />
              </div>
              <div>
                <Label htmlFor="propertyCity">City</Label>
                <Input id="propertyCity" value={formData.propertyCity} onChange={(e) => handleChange('propertyCity', e.target.value)} placeholder="e.g., New York" />
              </div>
              <div>
                <Label htmlFor="propertyState">State</Label>
                <Input id="propertyState" value={formData.propertyState} onChange={(e) => handleChange('propertyState', e.target.value)} placeholder="e.g., NY" />
              </div>
              <div>
                <Label htmlFor="propertyUnit">Unit / Apt #</Label>
                <Input id="propertyUnit" value={formData.propertyUnit} onChange={(e) => handleChange('propertyUnit', e.target.value)} placeholder="e.g., Apt 4B" />
              </div>
            </div>
          </div>

          {/* Lease Term Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">3. Lease Term & Duration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="leaseStartDate">Lease Start Date</Label>
                <Input id="leaseStartDate" type="date" value={formData.leaseStartDate} onChange={(e) => handleChange('leaseStartDate', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="leaseDuration">Lease Duration (months)</Label>
                <Input id="leaseDuration" type="number" min="1" value={formData.leaseDuration} onChange={(e) => handleChange('leaseDuration', e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label htmlFor="leaseEndDate">Lease End Date</Label>
                <Input id="leaseEndDate" type="date" value={formData.leaseEndDate} onChange={(e) => handleChange('leaseEndDate', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* Rent & Payment Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">4. Rent & Payment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="monthlyRent">Monthly Rent (MXN $)</Label>
                <Input id="monthlyRent" type="number" step="0.01" value={formData.monthlyRent} onChange={(e) => handleChange('monthlyRent', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="securityDepositAmount">Security Deposit (MXN $)</Label>
                <Input id="securityDepositAmount" type="number" step="0.01" value={formData.securityDepositAmount} onChange={(e) => handleChange('securityDepositAmount', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="rentDueDateDay">Rent Due Date (day of month)</Label>
                <Input id="rentDueDateDay" type="number" min="1" max="31" value={formData.rentDueDateDay} onChange={(e) => handleChange('rentDueDateDay', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="lateFee">Late Fee (MXN $)</Label>
                <Input id="lateFee" type="number" step="0.01" value={formData.lateFee} onChange={(e) => handleChange('lateFee', e.target.value)} placeholder="e.g., 1000" />
              </div>
              <div>
                <Label htmlFor="gracePeriodDays">Grace Period (days)</Label>
                <Input id="gracePeriodDays" type="number" value={formData.gracePeriodDays} onChange={(e) => handleChange('gracePeriodDays', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Input id="paymentMethod" value={formData.paymentMethod} onChange={(e) => handleChange('paymentMethod', e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Property Furnishing Type */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">6. Property Furnishing Type</h3>
            <RadioGroup value={formData.propertyFurnishingType} onValueChange={(value) => handleChange('propertyFurnishingType', value)} className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Fully Furnished" id="fully" />
                <Label htmlFor="fully">Fully Furnished</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Semi-Furnished" id="semi" />
                <Label htmlFor="semi">Semi Furnished</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Unfurnished" id="unfurnished" />
                <Label htmlFor="unfurnished">Unfurnished</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Pet Policy */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">7. Pet Policy</h3>
            <RadioGroup value={formData.petPolicy} onValueChange={(value) => handleChange('petPolicy', value)} className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Pet Friendly" id="petFriendly" />
                <Label htmlFor="petFriendly">Pet Friendly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="No Pets Allowed" id="noPetsAllowed" />
                <Label htmlFor="noPetsAllowed">No Pets Allowed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Pets Negotiable" id="petsNegotiable" />
                <Label htmlFor="petsNegotiable">Pets Negotiable</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Property Features */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">8. Property Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="BalconyTerrace"
                  checked={formData.balconyTerrace}
                  onCheckedChange={(checked) => handleChange("balconyTerrace", checked)}
                />
                <Label htmlFor="BalconyTerrace">Balcony/Terrace</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="GardenYard"
                  checked={formData.gardenYard}
                  onCheckedChange={(checked) => handleChange("gardenYard", checked)}
                />
                <Label htmlFor="GardenYard">Garden/Yard</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="ParkingAvailable" checked={formData.ParkingAvailable} onCheckedChange={(checked) => handleChange('ParkingAvailable', checked)} />
                <Label htmlFor="ParkingAvailable">Parking Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="centralAC" checked={formData.centralAC} onCheckedChange={(checked) => handleChange('centralAC', checked)} />
                <Label htmlFor="centralAC">Central A/C</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="heatingIncluded" checked={formData.heatingIncluded} onCheckedChange={(checked) => handleChange('heatingIncluded', checked)} />
                <Label htmlFor="heatingIncluded">Heating Included</Label>
              </div>
              
              
              <div className="flex items-center space-x-2">
                <Checkbox id="otherUtilitiesIncluded" checked={formData.otherUtilitiesIncluded} onCheckedChange={(checked) => handleChange('otherUtilitiesIncluded', checked)} />
                <Label htmlFor="otherUtilitiesIncluded">Other Utilities</Label>
              </div>
            </div>
          </div>

          {/* Utilities Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">9. Utilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="waterIncluded" checked={formData.waterIncluded} onCheckedChange={(checked) => handleChange('waterIncluded', checked)} />
                <Label htmlFor="waterIncluded">Water Included</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="electricityIncluded" checked={formData.electricityIncluded} onCheckedChange={(checked) => handleChange('electricityIncluded', checked)} />
                <Label htmlFor="electricityIncluded">Electricity Included</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="gasIncluded" checked={formData.gasIncluded} onCheckedChange={(checked) => handleChange('gasIncluded', checked)} />
                <Label htmlFor="gasIncluded">Gas Included</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="internetIncluded" checked={formData.internetIncluded} onCheckedChange={(checked) => handleChange('internetIncluded', checked)} />
                <Label htmlFor="internetIncluded">Internet Included</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="trashSewageIncluded" checked={formData.trashSewageIncluded} onCheckedChange={(checked) => handleChange('trashSewageIncluded', checked)} />
                <Label htmlFor="trashSewageIncluded">Trash/Sewage Included</Label>
              </div>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">10. Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input id="emergencyContact" type="number" value={formData.emergencyContact} onChange={(e) => handleChange('emergencyContact', e.target.value.slice(0, 10))} placeholder="Name and phone number" />
              </div>
              <div>
                <Label htmlFor="emergencyResponseTimeHours">Response Time (hours)</Label>
                <Input id="emergencyResponseTimeHours" type="number" value={formData.emergencyResponseTimeHours} onChange={(e) => handleChange('emergencyResponseTimeHours', e.target.value)} placeholder="e.g., 24" />
              </div>
            </div>
          </div>

          {/* Additional Terms Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">11. Additional Terms & Conditions</h3>
            <div>
              <Label htmlFor="additionalTermsConditions">Additional Terms</Label>
              <Textarea id="additionalTermsConditions" value={formData.additionalTermsConditions} onChange={(e) => handleChange('additionalTermsConditions', e.target.value)} placeholder="Add any additional clauses, restrictions, or special conditions..." rows={4} />
            </div>
          </div>

          {/* Owner Documents Section */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">12. Owner Documents</h3>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Upload property documents.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1">
                  30 MB max per file
                </span>
              </div>

              <label htmlFor="ownerDocs" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-4 cursor-pointer hover:border-primary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">Upload Property Documents</p>
                    <p className="text-xs text-muted-foreground">Drag files here or click to choose PDFs and images.</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary text-white px-4 py-2 text-sm font-medium">Choose Files</span>
              </label>
              <input
                id="ownerDocs"
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleDocumentUpload}
                className="sr-only"
              />

              {formData.owner_docs?.length > 0 && (
                <div className="grid gap-3">
                  {formData.owner_docs.map((doc, index) => (
                    <a
                      key={doc}
                      href={doc}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-primary"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">Document {index + 1}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">{doc}</p>
                        </div>
                      </div>
                      <span className="text-xs text-primary group-hover:underline">View</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Signatures Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">13. Signatures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="landlordSignature">Landlord Signature</Label>
                <Input id="landlordSignature" value={formData.landlordSignature || ''} onChange={(e) => handleChange('landlordSignature', e.target.value)} placeholder="Signature will be added" readOnly className="bg-muted" />
              </div>
              <div />
            </div>
          </div>

          {!hideSubmitButton && (
            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-700">
                {isSubmitting ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                ) : (
                  <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {isEdit ? 'Save Changes' : 'Save & Generate Lease'}</span>
                )}
              </Button>
            </div>
          )}

        </form>
      </CardContent>
    </Card>
  );
}