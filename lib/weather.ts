import { unstable_cache } from "next/cache";

export type DailyWeather = {
  date: string;
  label: string;
  weatherCode: number;
  description: string;
  minTemp: number;
  maxTemp: number;
  precipitationProbability: number;
  precipitationMm: number;
  windKmh: number;
};

export type WeatherForecast = {
  location: string;
  days: DailyWeather[];
  fetchedAt: string;
};

function weatherDescription(code: number) {
  if (code === 0) return "Klart";
  if (code === 1) return "Mest klart";
  if (code === 2) return "Delvis molnigt";
  if (code === 3) return "Mulet";
  if (code === 45 || code === 48) return "Dimma";
  if (code >= 51 && code <= 57) return "Duggregn";
  if (code >= 61 && code <= 67) return "Regn";
  if (code >= 71 && code <= 77) return "Snö";
  if (code >= 80 && code <= 82) return "Regnskurar";
  if (code === 85 || code === 86) return "Snöbyar";
  if (code >= 95) return "Åska";
  return "Varierande";
}

async function fetchWeather(): Promise<WeatherForecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", "57.7210");
  url.searchParams.set("longitude", "12.9401");
  url.searchParams.set("timezone", "Europe/Stockholm");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set(`daily`, "weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Glenn News/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(String(response.status) + " " + response.statusText);
    }

    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_min?: number[];
        temperature_2m_max?: number[];
        precipitation_probability_max?: number[];
        precipitation_sum?: number[];
        wind_speed_10m_max?: number[];
      };
    };

    const daily = data.daily;

    if (!daily?.time?.length) {
      throw new Error("Väderdata saknas");
    }

    const days = daily.time.slice(0, 2).map((date, index) => ({
      date,
      label: index === 0 ? "Idag" : "Imorgon",
      weatherCode: daily.weather_code?.[index] ?? 0,
      description: weatherDescription(daily.weather_code?.[index] ?? 0),
      minTemp: Math.round(daily.temperature_2m_min?.[index] ?? 0),
      maxTemp: Math.round(daily.temperature_2m_max?.[index] ?? 0),
      precipitationProbability: Math.round(daily.precipitation_probability_max?.[index] ?? 0),
      precipitationMm: Number((daily.precipitation_sum?.[index] ?? 0).toFixed(1)),
      windKmh: Math.round(daily.wind_speed_10m_max?.[index] ?? 0),
    }));

    return {
      location: "Borås",
      days,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Väderhämtning misslyckades:", error);
    return {
      location: "Borås",
      days: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

const getCachedWeatherInternal = unstable_cache(
  async () => fetchWeather(),
  ["glenn-news-weather-boras-v1"],
  {
    revalidate: 60 * 60,
    tags: ["glenn-news-weather"],
  }
);

export async function getCachedWeather() {
  return getCachedWeatherInternal();
}