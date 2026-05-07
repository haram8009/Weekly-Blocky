import {
  getCategoryById,
  listActiveCategories,
  listCategories,
  type ListCategoriesOptions,
} from '@weekly/data';

import { getSupabaseClient } from './client';

export function listMobileCategories(options?: ListCategoriesOptions) {
  return listCategories(getSupabaseClient(), options);
}

export function listMobileActiveCategories() {
  return listActiveCategories(getSupabaseClient());
}

export function getMobileCategoryById(id: string) {
  return getCategoryById(getSupabaseClient(), id);
}

export type { ListCategoriesOptions } from '@weekly/data';
