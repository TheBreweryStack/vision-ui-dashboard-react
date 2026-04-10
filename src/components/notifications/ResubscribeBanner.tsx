import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface ResubscribeBannerProps {
  onResubscribe: () => void;
  isLoading?: boolean;
}

export function ResubscribeBanner({ onResubscribe, isLoading }: ResubscribeBannerProps) {
  return (
    <Alert className="border-warning/50 bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-foreground">Push notifications need refresh</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
        <span className="text-muted-foreground text-sm">
          Our notification system was updated. Please re-enable to continue receiving alerts.
        </span>
        <Button 
          onClick={onResubscribe} 
          size="sm"
          disabled={isLoading}
          className="w-fit"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-enable Now
        </Button>
      </AlertDescription>
    </Alert>
  );
}
