import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { currentUser, hasPermission } from '@/mocks/access'
import {
  deleteDictItem,
  dictionaries,
  saveDictItem,
  type DictItems,
  type DictKind,
  type DictionariesData,
} from '@/mocks/dictionaries'
import type { Db } from '@/mocks/seed'
import { audit } from '@/mocks/audit'
import type { Id, User } from '@/shared/types/domain'

export type { DictKind, DictionariesData }

const DICT_TITLES: Record<DictKind, string> = {
  productGroup: 'Группы продуктов',
  productLine: 'Линейки',
  vatRate: 'Ставки НДС',
  businessType: 'Типы бизнеса',
  region: 'Регионы',
  paymentMethod: 'Способы оплаты',
  paymentTerm: 'Условия оплаты',
  deliveryTerm: 'Условия поставки',
}

const guard = (db: Db, user: User) => {
  if (!hasPermission(db, user, 'dictionaries.manage')) throw new MockError('forbidden', 'Справочники вам недоступны')
}

export const dictionariesApi = api.injectEndpoints({
  endpoints: (b) => ({
    getDictionaries: b.query<DictionariesData, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          guard(db, currentUser(db, qa))
          return dictionaries(db)
        }),
      providesTags: ['Dictionary'],
    }),

    saveDictionaryItem: b.mutation<{ id: Id }, { kind: DictKind; item: Partial<DictItems[DictKind]> & { id?: Id } }>({
      queryFn: ({ kind, item }, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            const id = saveDictItem(db, kind, item)
            const row = item as { name?: string; code?: string; rate?: number }
            audit(db, currentUser(db, qa), {
              entity: 'dictionary',
              entityId: id,
              entityName: String(row.name ?? row.code ?? (row.rate !== undefined ? `Ставка ${row.rate}%` : id)),
              action: item.id ? 'Изменена запись' : 'Добавлена запись',
              summary: DICT_TITLES[kind],
            })
            return { id }
          },
          { write: true },
        ),
      invalidatesTags: ['Dictionary', 'Product', 'Client', 'Application'],
    }),

    deleteDictionaryItem: b.mutation<void, { kind: DictKind; id: Id }>({
      queryFn: ({ kind, id }, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            const removed = (
              dictionaries(db)[
                (
                  {
                    productGroup: 'productGroups',
                    productLine: 'productLines',
                    vatRate: 'vatRates',
                    businessType: 'businessTypes',
                    region: 'regions',
                    paymentMethod: 'paymentMethods',
                    paymentTerm: 'paymentTerms',
                    deliveryTerm: 'deliveryTerms',
                  } as const
                )[kind]
              ] as { id: string; name?: string; code?: string; rate?: number }[]
            ).find((x) => x.id === id)
            deleteDictItem(db, kind, id)
            audit(db, currentUser(db, qa), {
              entity: 'dictionary',
              entityId: id,
              entityName: String(
                removed?.name ?? removed?.code ?? (removed?.rate !== undefined ? `Ставка ${removed.rate}%` : id),
              ),
              action: 'Удалена запись',
              summary: DICT_TITLES[kind],
            })
          },
          { write: true },
        ),
      invalidatesTags: ['Dictionary', 'Product', 'Client', 'Application'],
    }),
  }),
})

export const { useGetDictionariesQuery, useSaveDictionaryItemMutation, useDeleteDictionaryItemMutation } =
  dictionariesApi
