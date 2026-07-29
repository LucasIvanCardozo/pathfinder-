'use client';

import { useEffect } from 'react';
import { FormProvider, useForm, useWatch, type Control } from 'react-hook-form';
import { FormField, FormSelect, FormSlider } from '@/components/form';
import styles from './weather-panel.module.css';
import { WEATHERS, type WeatherDef } from './registry';

export type WeatherState = {
  weatherId: string;
  volume: number; // 0..100
};

type Props = {
  onChange: (state: WeatherState) => void;
  initial?: WeatherState;
};

const DEFAULT: WeatherState = { weatherId: 'none', volume: 100 };
export const WEATHER_DEFAULT: WeatherState = DEFAULT;

/**
 * Narrow-subscription watcher. Uses `useWatch({ control, name })` per field so
 * the form re-renders only when `weatherId` or `volume` change — not when other
 * fields are touched, registered, or blurred. Pushes the merged state up to
 * the parent via `onChange`.
 */
function WeatherWatcher({ control, onChange }: { control: Control<WeatherState>; onChange: (state: WeatherState) => void }) {
  const weatherId = useWatch({ control, name: 'weatherId' }) ?? DEFAULT.weatherId;
  const volume = useWatch({ control, name: 'volume' }) ?? DEFAULT.volume;

  useEffect(() => {
    onChange({ weatherId, volume });
  }, [onChange, weatherId, volume]);

  return null;
}

export function WeatherPanel({ onChange, initial }: Props) {
  const methods = useForm<WeatherState>({
    mode: 'onChange',
    defaultValues: { ...DEFAULT, ...initial },
  });

  const options = WEATHERS.map((w: WeatherDef) => ({
    value: w.id,
    label: w.label,
  }));

  return (
    <FormProvider {...methods}>
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Clima</h3>
        <FormField label="Seleccionar clima" htmlFor="weatherId">
          <FormSelect name="weatherId" options={options} />
        </FormField>
        <FormField label="Volumen ambiente" htmlFor="volume">
          <FormSlider name="volume" min={0} max={100} step={1} />
        </FormField>
        <WeatherWatcher control={methods.control} onChange={onChange} />
      </section>
    </FormProvider>
  );
}
