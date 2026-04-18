import { mockOperationsRepository } from "./mockOperationsRepository";
import { supabaseOperationsRepository } from "./supabaseOperationsRepository";
import { getRequestedDataSource } from "../config/dataSource";

export function getOperationsRepository() {
  const requestedSource = getRequestedDataSource();

  if (requestedSource === "supabase") {
    return supabaseOperationsRepository;
  }

  return mockOperationsRepository;
}
