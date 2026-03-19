import { useEffect, useState } from "react";
import {
  getAssigneeClassName,
  getAssigneeDisplayName,
  getAssigneeInitials
} from "../lib/assignee";

interface AssigneeAvatarProps {
  assignee: string | undefined;
  avatarUrl: string | undefined;
}

export function AssigneeAvatar({ assignee, avatarUrl }: AssigneeAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const displayName = getAssigneeDisplayName(assignee);
  const initials = getAssigneeInitials(assignee);
  const shouldRenderImage = Boolean(avatarUrl) && !hasImageError && displayName !== "Unassigned";

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  return (
    <span className={`${getAssigneeClassName(assignee)}${shouldRenderImage ? " avatar-chip--image" : ""}`}>
      {shouldRenderImage ? (
        <img
          alt=""
          className="avatar-chip__image"
          loading="lazy"
          onError={() => setHasImageError(true)}
          src={avatarUrl}
        />
      ) : (
        initials || " "
      )}
    </span>
  );
}
