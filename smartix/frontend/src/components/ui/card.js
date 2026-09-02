import React from 'react';
import PropTypes from 'prop-types';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`rounded-xl bg-card text-card-foreground shadow-sm border border-border/50 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '', ...props }) => {
  return (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className = '', ...props }) => {
  return (
    <p className={`text-sm text-muted-foreground ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className = '', ...props }) => {
  return (
    <div className={`flex items-center p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
};
Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
CardHeader.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
CardTitle.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
CardDescription.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
CardContent.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
CardFooter.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
