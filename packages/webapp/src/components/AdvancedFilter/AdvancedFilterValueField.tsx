// @ts-nocheck
import React, { useMemo } from 'react';
import { Position, Checkbox, InputGroup } from '@blueprintjs/core';
import { DateInput } from '@blueprintjs/datetime';
import moment from 'moment';
import intl from 'react-intl-universal';
import { isUndefined } from 'lodash';

import { useAutofocus } from '@/hooks';
import { T, Choose } from '@/components';
import { Select } from '@/components/Forms';
import { ContactsSuggestField } from '@/components/Contacts';
import { useAutoCompleteContacts } from '@/hooks/query/contacts';
import { momentFormatter } from '@/utils';

function AdvancedFilterEnumerationField({ options, value, ...rest }) {
  const selectedItem = useMemo(
    () => options.find((opt) => opt.key === value) || null,
    [options, value],
  );

  return (
    <Select
      items={options}
      selectedItem={selectedItem}
      popoverProps={{
        fill: true,
        inline: true,
        minimal: true,
        captureDismiss: true,
      }}
      placeholder={<T id={'filter.select_option'} />}
      textAccessor={'label'}
      valueAccessor={'key'}
      {...rest}
    />
  );
}

/**
 * Relation (customer / vendor) value field. Renders a search-as-you-type
 * contact picker and emits the selected contact id as the filter value.
 */
function AdvancedFilterRelationValueField({ relationKey, value, onChange }) {
  // `contact_type` is business/individual — the customer/vendor distinction
  // lives on `contact_service`.
  const contactService =
    relationKey === 'customer'
      ? 'customer'
      : relationKey === 'vendor'
        ? 'vendor'
        : null;

  const { data: contacts, isLoading } = useAutoCompleteContacts({
    limit: 100,
  });

  const filteredContacts = useMemo(
    () =>
      (contacts || []).filter(
        (contact) => !contactService || contact.contact_service === contactService,
      ),
    [contacts, contactService],
  );

  return (
    <ContactsSuggestField
      contactsList={filteredContacts}
      selectedContactId={Number(value) || undefined}
      onContactSelected={(contact) => onChange(contact.id)}
      defaultTextSelect={intl.get('filter.value')}
      disabled={isLoading}
      popoverFill={true}
    />
  );
}

const IFieldType = {
  ENUMERATION: 'enumeration',
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  DATE: 'date',
  RELATION: 'relation',
};

function tansformDateValue(date, defaultValue = null) {
  return date ? moment(date).toDate() : defaultValue;
}
/**
 * Advanced filter value field detarminer.
 */
export default function AdvancedFilterValueField2({
  value,
  fieldType,
  relationKey,
  options,
  onChange,
  isFocus,
}) {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    if (localValue !== value && !isUndefined(value)) {
      setLocalValue(value);
    }
  }, [localValue, value]);

  // Input field reference.
  const valueRef = useAutofocus(isFocus);

  const triggerOnChange = (value) => onChange && onChange(value);

  // Handle input change.
  const handleInputChange = (e) => {
    if (e.currentTarget.type === 'checkbox') {
      setLocalValue(e.currentTarget.checked);
      triggerOnChange(e.currentTarget.checked);
    } else {
      setLocalValue(e.currentTarget.value);
      triggerOnChange(e.currentTarget.value);
    }
  };

  // Handle enumeration field type change.
  const handleEnumerationChange = (option) => {
    setLocalValue(option.key);
    triggerOnChange(option.key);
  };

  // Handle date field change.
  const handleDateChange = (date) => {
    const formattedDate = moment(date).format('YYYY/MM/DD');

    setLocalValue(formattedDate);
    triggerOnChange(formattedDate);
  };

  return (
    <Choose>
      <Choose.When condition={fieldType === IFieldType.ENUMERATION}>
        <AdvancedFilterEnumerationField
          options={options}
          value={localValue}
          onItemSelect={handleEnumerationChange}
        />
      </Choose.When>

      <Choose.When condition={fieldType === IFieldType.RELATION}>
        <AdvancedFilterRelationValueField
          relationKey={relationKey}
          value={localValue}
          onChange={triggerOnChange}
        />
      </Choose.When>

      <Choose.When condition={fieldType === IFieldType.DATE}>
        <DateInput
          {...momentFormatter('YYYY/MM/DD')}
          value={tansformDateValue(localValue)}
          onChange={handleDateChange}
          popoverProps={{
            minimal: true,
            position: Position.BOTTOM,
          }}
          shortcuts={true}
          placeholder={intl.get('filter.enter_date')}
          fill={true}
          inputProps={{
            fill: true,
          }}
        />
      </Choose.When>

      <Choose.When condition={fieldType === IFieldType.BOOLEAN}>
        <Checkbox value={localValue} onChange={handleInputChange} />
      </Choose.When>

      <Choose.When condition={fieldType === IFieldType.NUMBER}>
        <InputGroup
          type={'number'}
          placeholder={intl.get('filter.value')}
          onChange={handleInputChange}
          value={localValue ?? ''}
          inputRef={valueRef}
        />
      </Choose.When>

      <Choose.Otherwise>
        <InputGroup
          placeholder={intl.get('filter.value')}
          onChange={handleInputChange}
          value={localValue}
          inputRef={valueRef}
        />
      </Choose.Otherwise>
    </Choose>
  );
}
