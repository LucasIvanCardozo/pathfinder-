"use client";

import { FormProvider, useForm } from "react-hook-form";
import { FormField, FormSelect, FormSlider } from "@/components/form";
import styles from "./WeatherPanel.module.css";
import { WEATHERS, type WeatherDef } from "./registry";

export type WeatherState = {
  weatherId: string;
  volume: number; // 0..100
};

type Props = {
  onChange: (state: WeatherState) => void;
  initial?: WeatherState;
};

const DEFAULT: WeatherState = { weatherId: "none", volume: 100 };
export const WEATHER_DEFAULT: WeatherState = DEFAULT;

export function WeatherPanel({ onChange, initial }: Props) {
  const methods = useForm<WeatherState>({
    mode: "onChange",
    defaultValues: { ...DEFAULT, ...initial },
  });

  // Push form values up to the parent so the overlay + audio can react.
  // Using a single subscription on the whole form keeps the count to one.
  methods.watch((value) => {
    onChange({
      weatherId: value.weatherId ?? DEFAULT.weatherId,
      volume: value.volume ?? DEFAULT.volume,
    });
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
      </section>
    </FormProvider>
  );
}