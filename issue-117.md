## SOON TO BE IMPLEMENTED

Replace the header <Link> elements with <NavLink> from React Router and apply an active style using the accent token.
Update the code in src/App.tsx to use <NavLink> instead of <Link>.
Apply an active style to the <NavLink> component using the accent token, not just color.
Example code snippet:
jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  navLink: {
    /* Active style using accent token */
    fontWeight: theme.typography.fontWeightMedium,
    textDecoration: 'underline',
  },
}));

const App = () => {
  const classes = useStyles();

  return (
    <div>
      <nav>
        <NavLink
          to="/"
          className={classes.navLink}
          activeClassName={classes.activeNavLink}
        >
          Home
        </NavLink>
        <NavLink
          to="/about"
          className={classes.navLink}
          activeClassName={classes.activeNavLink}
        >
          About
        </NavLink>
        <NavLink
          to="/contact"
          className={classes.navLink}
          activeClassName={classes.activeNavLink}
        >
          Contact
        </NavLink>
        <NavLink
          to="/settings"
          className={classes.navLink}
          activeClassName={classes.activeNavLink}
        >
          Settings
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
};
Set aria-current="page" on the active link for assistive technology.
Update the code in src/App.tsx to set aria-current="page" on the active <NavLink> component.
Example code snippet:
jsx
<NavLink
  to="/"
  className={classes.navLink}
  activeClassName={classes.activeNavLink}
  aria-current={location.pathname === '/' ? 'page' : undefined}
>
  Home
</NavLink>
Ensure that focus-visible styling remains distinct from the active style.
Update the code in src/index.css to ensure that focus-visible styling is distinct from the active style.
Example code snippet:
css
.navLink:focus-visible {
  /* Focus-visible styling */
  outline: 2px solid #007bff;
}
Test and commit the changes.
Run npm run dev and click through the routes to verify that the active route is visually distinct and the focus-visible styling is distinct from the active style.
Run npm run test to ensure that the changes do not break any existing tests.
Commit the changes with a descriptive commit message.
Example commit message:

task: add active-route indicator to header nav
Acceptance criteria:

The active link is visually distinct beyond color.
The active link carries aria-current="page".
Focus-visible styling is distinct from the active style.
The changes work for all four routes.

