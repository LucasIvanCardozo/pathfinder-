'use client';

import { useEffect } from 'react';
import { type Control, FormProvider, useForm, useWatch } from 'react-hook-form';
import { MUSIC_TRACKS, type MusicDef, WEATHERS, type WeatherDef } from '@/canvas';
import { FormField, FormSelect, FormSlider } from '@/components/form';
import { AMBIENT_DEFAULT } from '@/lib/shared/constants';
import styles from './ambient-panel.module.css';

export type AmbientState = {
  weatherId: string;
  weatherVolume: number; // 0..100
  musicId: string;
  musicVolume: number; // 0..100
};

type Props = {
  onChange: (state: AmbientState) => void;
  initial?: AmbientState;
};

export { AMBIENT_DEFAULT };

/**
 * Narrow-subscription watcher. Uses `useWatch({ control, name })` per
 * field so the form re-renders only when one of the four tracked fields
 * changes — not on register/blur/touch. Pushes the merged state up via
 * `onChange` (parent owns persistence, audio engine, etc.).
 */
function AmbientWatcher({
  control,
  onChange,
}: {
  control: Control<AmbientState>;
  onChange: (state: AmbientState) => void;
}) {
  const weatherId = useWatch({ control, name: 'weatherId' }) ?? AMBIENT_DEFAULT.weatherId;
  const weatherVolume =
    useWatch({ control, name: 'weatherVolume' }) ?? AMBIENT_DEFAULT.weatherVolume;
  const musicId = useWatch({ control, name: 'musicId' }) ?? AMBIENT_DEFAULT.musicId;
  const musicVolume = useWatch({ control, name: 'musicVolume' }) ?? AMBIENT_DEFAULT.musicVolume;

  useEffect(() => {
    onChange({ weatherId, weatherVolume, musicId, musicVolume });
  }, [onChange, weatherId, weatherVolume, musicId, musicVolume]);

  return null;
}

export function AmbientPanel({ onChange, initial }: Props) {
  const methods = useForm<AmbientState>({
    mode: 'onChange',
    defaultValues: { ...AMBIENT_DEFAULT, ...initial },
  });

  const weatherOptions = WEATHERS.map((w: WeatherDef) => ({
    value: w.id,
    label: w.label,
  }));

  const musicOptions = MUSIC_TRACKS.map((m: MusicDef) => ({
    value: m.id,
    label: m.label,
  }));

  return (
    <FormProvider {...methods}>
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Ambiente</h3>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Clima</h4>
          <FormField label="Seleccionar clima" htmlFor="weatherId">
            <FormSelect name="weatherId" options={weatherOptions} />
          </FormField>
          <FormField label="Volumen ambiente" htmlFor="weatherVolume">
            <FormSlider name="weatherVolume" min={0} max={100} step={1} />
          </FormField>
        </div>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Música</h4>
          <FormField label="Seleccionar música" htmlFor="musicId">
            <FormSelect name="musicId" options={musicOptions} />
          </FormField>
          <FormField label="Volumen música" htmlFor="musicVolume">
            <FormSlider name="musicVolume" min={0} max={100} step={1} />
          </FormField>
        </div>
        <AmbientWatcher control={methods.control} onChange={onChange} />
      </section>
    </FormProvider>
  );
}
