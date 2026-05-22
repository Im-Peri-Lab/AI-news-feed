export interface ColorDef {
  bg: string;
  text: string;
  border: string;
}

// 10-color palette — ordered for maximum perceptual distance between adjacent entries.
// Each entry is a pastel chip that works in both light and dark contexts.
export const COLOR_PALETTE: ColorDef[] = [
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  }, // 0 글로벌
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }, // 1 국내
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  }, // 2 기술
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200'    }, // 3 모델 (brand-adjacent)
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    }, // 4 산업
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    }, // 5
  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   }, // 6
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  }, // 7
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    }, // 8
  { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200'    }, // 9
];

/** Returns the palette entry least used among existing categories. */
export function pickColor(existingColors: ColorDef[]): ColorDef {
  const usageCount = COLOR_PALETTE.map((p) =>
    existingColors.filter((c) => c.bg === p.bg).length
  );
  const minUsage = Math.min(...usageCount);
  const idx = usageCount.findIndex((n) => n === minUsage);
  return COLOR_PALETTE[idx];
}
