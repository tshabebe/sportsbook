import { useQuery } from "@tanstack/react-query";
import { POPULAR_LEAGUES, type League } from "../constants/leagues";

export type { League };

export const useLeagues = () => {
    return useQuery({
        queryKey: ["leagues", "popular", "static"],
        queryFn: async () => {
            // Return static data immediately from frontend constants
            return POPULAR_LEAGUES;
        },
        staleTime: Infinity, // Static data never expires
    });
};

