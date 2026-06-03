'use client';

import { useEffect } from 'react';
import TargetingBuilder, { type TargetingState } from './TargetingBuilder';

interface TargetingPanelProps {
  value: TargetingState;
  onChange: (v: TargetingState) => void;
  adAccountId: string;
  currency?: string;
}

const DEFAULT_TH: TargetingState = {
  geo_locations: { countries: ['TH'] },
  age_min: 18,
  age_max: 65,
};

export default function TargetingPanel({ value, onChange, adAccountId, currency }: TargetingPanelProps) {
  useEffect(() => {
    const hasGeo =
      value?.geo_locations?.countries?.length ||
      value?.geo_locations?.cities?.length ||
      value?.geo_locations?.regions?.length;
    if (!hasGeo) {
      onChange({ ...DEFAULT_TH, ...value, geo_locations: { countries: ['TH'] } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- default TH once on mount
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-100">
        ตั้งกลุ่มเป้าหมาย — ประเทศไทยเป็นค่าเริ่มต้นสำหรับ Reach จาก Meta
      </p>
      <TargetingBuilder
        value={value}
        onChange={onChange}
        adAccountId={adAccountId}
        currency={currency}
      />
    </div>
  );
}