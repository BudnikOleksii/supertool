'use client';

import type { FC } from 'react';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Link } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { I18N_NAMESPACE } from '@supertool/shared/constants/i18n-namespace';
import type { CategoryResponseDto } from '@supertool/shared/generated/types.gen';
import { Badge } from '@supertool/ui/src/components/atoms/badge/Badge';
import { Button } from '@supertool/ui/src/components/atoms/button/Button';
import { Typography } from '@supertool/ui/src/components/atoms/typography/Typography';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@supertool/ui/src/components/molecules/accordion/Accordion';

import { getCategoryEditPath } from '../../../../../constants/routes';
import { buildCategoryHierarchy } from '../../utils/category-hierarchy';
import { DeleteCategoryDialog } from '../delete-category-dialog/DeleteCategoryDialog';
import styles from './CategoryTree.module.scss';

interface Props {
  categoryList: CategoryResponseDto[];
}

const getTypeLabelKey = (type: CategoryResponseDto['type']): 'incomeType' | 'expenseType' =>
  type === 'income' ? 'incomeType' : 'expenseType';

const getTypeBadgeVariant = (type: CategoryResponseDto['type']): 'success' | 'warning' =>
  type === 'income' ? 'success' : 'warning';

export const CategoryTree: FC<Props> = ({ categoryList }) => {
  const translate = useTranslations(I18N_NAMESPACE.categoriesPage);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryResponseDto | null>(null);

  const { topLevelList, childrenByParentId } = useMemo(
    () => buildCategoryHierarchy(categoryList),
    [categoryList],
  );

  if (!topLevelList.length) {
    return (
      <div className={styles.empty}>
        <Typography variant="title-s" tag="h2">
          {translate('emptyTitle')}
        </Typography>
        <Typography variant="body-m" className={styles.emptyDescription}>
          {translate('emptyDescription')}
        </Typography>
      </div>
    );
  }

  const renderActions = (category: CategoryResponseDto) => (
    <div className={styles.actions}>
      <Button component={Link} href={getCategoryEditPath(category.id)} variant="ghost" size="sm">
        {translate('editButton')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setCategoryToDelete(category);
        }}
      >
        {translate('deleteButton')}
      </Button>
    </div>
  );

  return (
    <>
      <Accordion type="multiple" className={styles.tree}>
        {topLevelList.map((parent) => {
          const childList = childrenByParentId.get(parent.id) ?? [];

          return (
            <AccordionItem key={parent.id} value={parent.id} className={styles.item}>
              <div className={styles.row}>
                <AccordionTrigger className={styles.trigger}>
                  <span className={styles.name}>
                    {parent.name}
                    <Badge variant={getTypeBadgeVariant(parent.type)}>
                      {translate(getTypeLabelKey(parent.type))}
                    </Badge>
                  </span>
                </AccordionTrigger>
                {renderActions(parent)}
              </div>
              <AccordionContent>
                {childList.length ? (
                  <ul className={styles.childList}>
                    {childList.map((child) => (
                      <li key={child.id} className={styles.childRow}>
                        <Typography variant="body-m">{child.name}</Typography>
                        {renderActions(child)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Typography variant="body-s" className={styles.noChildren}>
                    {translate('noSubcategories')}
                  </Typography>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <DeleteCategoryDialog
        category={categoryToDelete}
        categoryList={categoryList}
        onClose={() => {
          setCategoryToDelete(null);
        }}
      />
    </>
  );
};
