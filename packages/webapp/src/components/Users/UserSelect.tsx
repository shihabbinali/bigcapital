// @ts-nocheck
import React from 'react';
import { MenuItem } from '@blueprintjs/core';
import { FSelect } from '../Forms';

/**
 * User select field (organization users, admin panel).
 * @param {*} props
 * @returns {JSX.Element}
 */
export function UserSelect({ users, ...rest }) {
  return (
    <FSelect
      valueAccessor={'id'}
      textAccessor={(user) =>
        user
          ? [user.firstName, user.lastName].filter(Boolean).join(' ')
          : ''
      }
      items={users}
      {...rest}
    />
  );
}
