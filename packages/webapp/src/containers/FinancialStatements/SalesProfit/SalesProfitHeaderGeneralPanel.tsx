// @ts-nocheck
import React from 'react';
import { FormGroup } from '@blueprintjs/core';

import FinancialStatementDateRange from '../FinancialStatementDateRange';
import { Row, Col, UserSelect } from '@/components';
import { useUsers, useAuthenticatedAccount } from '@/hooks/query/users';

/**
 * Sales profit - Drawer header - General panel.
 */
export default function SalesProfitHeaderGeneralPanel() {
  // Admin-only "filter by user" (the server ignores the param for non-admins).
  const { data: account } = useAuthenticatedAccount();
  const isAdmin = !!account?.is_admin;

  const { data: users, isLoading: isUsersLoading } = useUsers({
    enabled: isAdmin,
  });

  return (
    <div>
      <FinancialStatementDateRange />

      {isAdmin && (
        <Row>
          <Col xs={4}>
            <FormGroup label={'User'} disabled={isUsersLoading}>
              <UserSelect
                name={'userId'}
                users={users ?? []}
                disabled={isUsersLoading}
                placeholder={'All users'}
                popoverProps={{ minimal: true }}
              />
            </FormGroup>
          </Col>
        </Row>
      )}
    </div>
  );
}
