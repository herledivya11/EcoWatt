import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PredictionHistory {
    applianceCount: bigint;
    predictedUnits: number;
    billTotal: number;
    householdType: string;
    co2Emissions: number;
    timestamp: Time;
    dailyUsage: number;
}
export type Time = bigint;
export interface backendInterface {
    addPrediction(history: PredictionHistory): Promise<bigint>;
    getAllPredictions(): Promise<Array<PredictionHistory>>;
}
