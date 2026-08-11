import React, { type FC, useCallback, useEffect, useState } from 'react';
import { widget } from '@wix/editor';
import {
  FormField,
  Input,
  SectionHelper,
  SidePanel,
  WixDesignSystemProvider,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const DEFAULT_API_BASE_URL = 'https://skinrush-api-8z3s.onrender.com';

const Panel: FC = () => {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [pageSize, setPageSize] = useState('25');
  const pageSizeValid = /^\d+$/.test(pageSize) && Number(pageSize) >= 1 && Number(pageSize) <= 100;

  useEffect(() => {
    Promise.all([
      widget.getProp('api-base-url'),
      widget.getProp('page-size'),
    ]).then(([storedUrl, storedPageSize]) => {
      setApiBaseUrl(storedUrl || DEFAULT_API_BASE_URL);
      setPageSize(String(storedPageSize || 25));
    }).catch(error => console.error('Failed to load SkinRush widget settings:', error));
  }, []);

  const handleApiUrl = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();
    setApiBaseUrl(event.target.value);
    if (/^https:\/\//i.test(value)) widget.setProp('api-base-url', value);
  }, []);

  const handlePageSize = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPageSize(value);
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100) {
      widget.setProp('page-size', value);
    }
  }, []);

  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <SidePanel.Field>
            <FormField label="API base URL">
              <Input
                type="url"
                value={apiBaseUrl}
                onChange={handleApiUrl}
                aria-label="API base URL"
              />
            </FormField>
          </SidePanel.Field>
          <SidePanel.Field>
            <FormField label="Results per page">
              <Input
                type="number"
                min={1}
                max={100}
                value={pageSize}
                onChange={handlePageSize}
                aria-label="Results per page"
              />
            </FormField>
          </SidePanel.Field>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <SectionHelper
            fullWidth
            appearance={pageSizeValid ? 'success' : 'warning'}
            border="topBottom"
          >
            {pageSizeValid
              ? 'Public database settings are valid.'
              : 'Results per page must be between 1 and 100.'}
          </SectionHelper>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
