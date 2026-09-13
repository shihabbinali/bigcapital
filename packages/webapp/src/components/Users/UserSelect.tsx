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
  // /users returns snake_cased fields — map to explicit {value,label}
  // options with string accessors (null-safe, filterable).
  const options = (users || []).map((user) => ({
    value: user.id,
    label:
      user.full_name ||
      [user.first_name, user.last_name].filter(Boolean).join(' '),
  }));

  return (
    <FSelect
      valueAccessor={'value'}
      textAccessor={'label'}
      items={options}
      {...rest}
    />
  );
}
