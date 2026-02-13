import axios from "axios";
import type { AxiosError } from "axios";
import { CONFIG } from "./TestConfig";

export interface ClimaResponse {
  message: string;
  messageId: string;
  ciudad: string;
  clima?: string;
  temperatura?: string;
  status?: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: string;
}

export class APIGatewayHelper {
  static baseUrl = CONFIG.API_GATEWAY_URL;

  static async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
      headers: { "Content-Type": "application/json" },
    });

    return response.data;
  }

  static async consultarClima(ciudad: string): Promise<ClimaResponse> {
    return this.post<ClimaResponse>("/clima", { ciudad });
  }

  static extractError(error: any): ErrorResponse {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      return axiosError.response?.data || { error: "Error desconocido" };
    }
    return { error: error.message || "Error desconocido" };
  }
}
