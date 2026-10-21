import type { Region } from '@/shared/types/domain'
import { useGetClientRefsQuery } from '../clientsApi'

/** Справочник регионов для форм. */
export function useRegions(): Region[] {
  return useGetClientRefsQuery().data?.regions ?? []
}
