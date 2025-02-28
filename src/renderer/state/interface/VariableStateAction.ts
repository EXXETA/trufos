import { VariableMap } from 'shim/objects/variables';

export interface VariableStateActions {
  /**
   * Initialize the variables of the current collection
   * @param variables
   */
  initialize(variables: VariableMap): void;

  /**
   * Set the variables of the current collection
   * @param variables The new variables to set
   */
  setVariables(variables: VariableMap): Promise<void>;
}
