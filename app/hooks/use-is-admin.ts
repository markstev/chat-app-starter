import { useContext } from "react";
import { AmplitudeUserContext } from "./use-amplitude";

/**
 * Hook to get admin status from Clerk user metadata
 * @returns boolean indicating if the current user is an admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useContext(AmplitudeUserContext);
  return isAdmin;
}

