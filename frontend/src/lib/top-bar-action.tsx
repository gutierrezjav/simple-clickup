import { createContext, useContext, useEffect } from "react";

export interface TopBarAction {
  disabled?: boolean;
  label: string;
  onAction: () => void;
}

export const TopBarActionContext = createContext<((action: TopBarAction | null) => void) | null>(
  null
);

export function useTopBarAction(action: TopBarAction | null) {
  const setTopBarAction = useContext(TopBarActionContext);

  useEffect(() => {
    if (!setTopBarAction) {
      return;
    }

    setTopBarAction(action);
    return () => {
      setTopBarAction(null);
    };
  }, [action, setTopBarAction]);
}
