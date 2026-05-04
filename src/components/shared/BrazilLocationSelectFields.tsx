"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brazilStates, getBrazilCitiesForState, isBrazilCityInState, normalizeBrazilStateName } from "@/lib/locations/brazil";
import { cn } from "@/lib/utils";

function fieldClass(hasError?: boolean) {
  return cn(hasError && "border-destructive bg-destructive/5 ring-2 ring-destructive/20");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

type BrazilLocationSelectFieldsProps = {
  stateValue?: string;
  cityValue?: string;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  stateError?: string;
  cityError?: string;
  stateId?: string;
  cityId?: string;
  stateLabel?: string;
  cityLabel?: string;
  className?: string;
};

export function BrazilLocationSelectFields({
  stateValue,
  cityValue,
  onStateChange,
  onCityChange,
  stateError,
  cityError,
  stateId = "state",
  cityId = "city",
  stateLabel = "Estado",
  cityLabel = "Cidade",
  className,
}: BrazilLocationSelectFieldsProps) {
  const normalizedState = normalizeBrazilStateName(stateValue);
  const cities = getBrazilCitiesForState(normalizedState);
  const selectedCity = normalizedState && isBrazilCityInState(normalizedState, cityValue) ? cityValue : "";

  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      <div className="space-y-2">
        <Label htmlFor={stateId} className={cn(stateError && "text-destructive")}>
          {stateLabel}
        </Label>
        <Select
          value={normalizedState}
          onValueChange={(nextState) => {
            onStateChange(nextState);
            if (!isBrazilCityInState(nextState, cityValue)) {
              onCityChange("");
            }
          }}
        >
          <SelectTrigger id={stateId} aria-invalid={Boolean(stateError)} className={cn("w-full", fieldClass(Boolean(stateError)))}>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent>
            {brazilStates.map((state) => (
              <SelectItem value={state.name} key={state.code}>
                {state.code} - {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={stateError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={cityId} className={cn(cityError && "text-destructive")}>
          {cityLabel}
        </Label>
        <Select value={selectedCity ?? ""} onValueChange={onCityChange} disabled={!normalizedState}>
          <SelectTrigger id={cityId} aria-invalid={Boolean(cityError)} className={cn("w-full", fieldClass(Boolean(cityError)))}>
            <SelectValue placeholder={normalizedState ? "Selecione a cidade" : "Selecione o estado primeiro"} />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem value={city} key={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={cityError} />
      </div>
    </div>
  );
}
