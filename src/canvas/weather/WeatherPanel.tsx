"use client";

import { FormProvider, useForm } from "react-hook-form";
import { FormField, FormSelect, FormSlider } from "@/app/components/form";
import { WEATHERS, type WeatherDef } from "./registry";

export type WeatherState = {
  weatherId: string;
  volume: number; // 0..100
};

type Props = {
  onChange: (state: WeatherState) => void;
  initial?: WeatherState;
};

const DEFAULT: WeatherState = { weatherId: "none", volume: 50 };

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
      <section className="weather-panel">
        <h3 className="weather-panel-title">Clima</h3>
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
