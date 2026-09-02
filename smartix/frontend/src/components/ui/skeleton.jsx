import { cn } from '../../lib/utils'
import PropTypes from 'prop-types';

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props} />
  );
}

export { Skeleton }
Skeleton.propTypes = {
  className: PropTypes.any.isRequired,
  props: PropTypes.any.isRequired,
};
