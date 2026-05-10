import { listCategories, listActiveCategories, type ListCategoriesOptions } from '@weekly/data';

import { getSupabaseClient } from './client';

export function listWebCategories(options?: ListCategoriesOptions) {
  return listCategories(getSupabaseClient(), options);
}

export function listWebActiveCategories() {
  return listActiveCategories(getSupabaseClient());
}

export type { ListCategoriesOptions } from '@weekly/data';
