import {
  archiveCategory,
  createCategory,
  getCategoryById,
  listActiveCategories,
  listCategories,
  updateCategory,
  type ArchiveCategoryInput,
  type CreateCategoryInput,
  type ListCategoriesOptions,
  type UpdateCategoryInput,
} from '@weekly/data';

import { getSupabaseClient } from './client';

export function listMobileCategories(options?: ListCategoriesOptions) {
  return listCategories(getSupabaseClient(), options);
}

export function listMobileActiveCategories() {
  return listActiveCategories(getSupabaseClient());
}

export function listMobileCategoryPaletteCategories() {
  return listMobileActiveCategories();
}

export function getMobileCategoryById(id: string) {
  return getCategoryById(getSupabaseClient(), id);
}

export function createMobileCategory(input: CreateCategoryInput) {
  return createCategory(getSupabaseClient(), input);
}

export function updateMobileCategory(input: UpdateCategoryInput) {
  return updateCategory(getSupabaseClient(), input);
}

export function archiveMobileCategory(input: ArchiveCategoryInput) {
  return archiveCategory(getSupabaseClient(), input);
}

export type {
  ArchiveCategoryInput,
  CreateCategoryInput,
  ListCategoriesOptions,
  UpdateCategoryInput,
} from '@weekly/data';
