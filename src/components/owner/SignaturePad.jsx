import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function SignaturePad({ onSave, onCancel, isSubmitting, title = "Sign Here", submitLabel = "Confirm Signature", savedSignatures = [], hideButtons = false, disableSubmit = false }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [selectedSavedSignature, setSelectedSavedSignature] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setSelectedSavedSignature(null);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSelectedSavedSignature(null);
  };

  const handleSave = () => {
    if (selectedSavedSignature) {
      onSave(selectedSavedSignature);
    } else {
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL('image/png');
      onSave(signatureData);
    }
  };

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {savedSignatures && savedSignatures.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Select a saved signature:</label>
              <div className="flex gap-3 flex-wrap">
                {savedSignatures.map((sigUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedSavedSignature(sigUrl);
                      const canvas = canvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                      }
                      setHasSignature(false);
                    }}
                    className={`p-1.5 border rounded-lg bg-white hover:border-blue-500 transition-colors relative aspect-[3/1] h-14 flex items-center justify-center ${selectedSavedSignature === sigUrl ? 'border-2 border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-200'}`}
                  >
                    <img src={sigUrl} alt={`Saved signature ${idx + 1}`} className="max-h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {savedSignatures && savedSignatures.length > 0 && (
              <label className="text-xs font-semibold text-muted-foreground">Or draw a new signature:</label>
            )}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full h-32 touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          </div>
          
          {!hideButtons && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={clearCanvas}
                disabled={isSubmitting}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || (!hasSignature && !selectedSavedSignature) || disableSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {submitLabel}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}