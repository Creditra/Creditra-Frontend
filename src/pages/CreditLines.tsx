import { useState, useMemo } from 'react';
import { RepayModal } from '../components/RepayModal';

import type {
  CreditLine,
  CreditLineStatus,
  SortField,
  SortDirection,
  UtilizationLevel,
} from '../types/creditLine';

import { MOCK_CREDIT_LINES } from '../data/mockData';

import {
  COLOR,
  UTIL_COLOR,
  STATUS_COLOR,
  RISK_COLOR,
  inputStyle,
  btn,
  fmt,
  fmtDate,
  fmtDateTime,
  getUtilizationLevel,
  utilizationPct,
} from '../utils/tokens';