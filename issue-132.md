## SOON TO BE IMPLEMENTED

Add toggleable filter chips:
Implement a labeled toggle-button group with aria-pressed.
Use a component library like React-Bootstrap or Material-UI to create the toggleable filter chips.
Ensure that the toggle buttons have proper accessibility attributes like aria-pressed to indicate their state.
Example code snippet:
jsx
import React, { useState } from 'react';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  toggleButtonGroup: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: theme.spacing(2),
  },
}));

const FilterChips = () => {
  const classes = useStyles();
  const [selectedFilters, setSelectedFilters] = useState([]);

  const handleFilterChange = (event, value) => {
    setSelectedFilters(value);
  };

  return (
    <div className={classes.toggleButtonGroup}>
      <ToggleButtonGroup
        color="primary"
        value={selectedFilters}
        exclusive
        onChange={handleFilterChange}
        aria-label="filter chips"
      >
        <ToggleButton value="All">All</ToggleButton>
        <ToggleButton value="Draw">Draw</ToggleButton>
        <ToggleButton value="Repay">Repay</ToggleButton>
        <ToggleButton value="Fee">Fee</ToggleButton>
        <ToggleButton value="Interest">Interest</ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
};
Add date presets:
Implement a labeled toggle-button group with aria-pressed for date presets.
Use a component library like React-Bootstrap or Material-UI to create the date presets.
Ensure that the date presets have proper accessibility attributes like aria-pressed to indicate their state.
Example code snippet:
jsx
import React, { useState } from 'react';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  toggleButtonGroup: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: theme.spacing(2),
  },
}));

const DatePresets = () => {
  const classes = useStyles();
  const [selectedDatePreset, setSelectedDatePreset] = useState('');

  const handleDatePresetChange = (event, value) => {
    setSelectedDatePreset(value);
  };

  return (
    <div className={classes.toggleButtonGroup}>
      <ToggleButtonGroup
        color="primary"
        value={selectedDatePreset}
        exclusive
        onChange={handleDatePresetChange}
        aria-label="date presets"
      >
        <ToggleButton value="7d">7d</ToggleButton>
        <ToggleButton value="30d">30d</ToggleButton>
        <ToggleButton value="90d">90d</ToggleButton>
        <ToggleButton value="All">All</ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
};
Show a "No transactions match these filters" empty state with a "Clear filters" action:
Create a separate component for the empty state.
Display a polite message indicating that there are no transactions matching the filters.
Provide a "Clear filters" action to allow users to remove the filters.
Example code snippet:
jsx
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  emptyStateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: theme.spacing(4),
  },
  emptyStateMessage: {
    fontSize: '1





Advanced
