import type { AFrameInputs, PanelOption, PanelProduct } from "@/types/project";

export const numberOptionValue = (value: string | number) => (typeof value === "number" ? value : Number(value));

export function closestNumber(value: number, options: number[]) {
  return options.reduce((closest, option) => (Math.abs(option - value) < Math.abs(closest - value) ? option : closest), options[0]);
}

export function getPanelThicknessOptions(panel: PanelProduct) {
  return panel.allowedThicknessMm?.length ? panel.allowedThicknessMm : [panel.thicknessMm];
}

export function getPanelLengthOptions(panel: PanelProduct) {
  if (panel.allowedLengthsM?.length) return panel.allowedLengthsM;
  if (panel.minLengthM && panel.maxLengthM && panel.lengthStepM) {
    const values: number[] = [];
    for (let value = panel.minLengthM; value <= panel.maxLengthM + 0.001; value += panel.lengthStepM) {
      values.push(Number(value.toFixed(2)));
    }
    return values;
  }
  return [panel.lengthM];
}

export function getPanelExternalOptions(panel: PanelProduct): PanelOption[] {
  return panel.externalColorOptions?.length
    ? panel.externalColorOptions
    : [{ id: "current", label: panel.externalFinish || panel.colorCode, value: panel.colorHex, colorHex: panel.colorHex }];
}

export function getPanelInternalOptions(panel: PanelProduct): PanelOption[] {
  return panel.internalFinishOptions?.length
    ? panel.internalFinishOptions
    : [{ id: "current", label: panel.internalFinish, value: panel.colorHex, colorHex: panel.colorHex }];
}

export function coerceAFrameToPanel(aFrame: AFrameInputs, panel: PanelProduct): AFrameInputs {
  if (panel.isCustom) {
    return aFrame;
  }

  const thicknessOptions = getPanelThicknessOptions(panel);
  const lengthOptions = getPanelLengthOptions(panel);
  const nextThickness = thicknessOptions.includes(aFrame.panelThickness)
    ? aFrame.panelThickness
    : closestNumber(aFrame.panelThickness, thicknessOptions);
  const nextLength = lengthOptions.includes(aFrame.panelLength) ? aFrame.panelLength : closestNumber(aFrame.panelLength, lengthOptions);

  return {
    ...aFrame,
    panelLength: nextLength,
    panelUsefulWidth: panel.usefulWidthM,
    panelThickness: nextThickness,
  };
}

