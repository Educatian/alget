from typing import Dict, List, Tuple
import math

class BayesianKnowledgeTracing:
    """
    Implements Bayesian Knowledge Tracing (BKT) calculation for mastery updates.
    """
    def __init__(self, p_guess_default=0.2, p_slip_default=0.1, p_transit_default=0.1):
        self.p_guess_default = p_guess_default
        self.p_slip_default = p_slip_default
        self.p_transit_default = p_transit_default

    def update_p_known(self, p_known: float, is_correct: bool, 
                       p_guess: float = None, p_slip: float = None, p_transit: float = None) -> float:
        """
        Calculates the new probability that a student knows a concept after an attempt.
        """
        guess = p_guess if p_guess is not None else self.p_guess_default
        slip = p_slip if p_slip is not None else self.p_slip_default
        transit = p_transit if p_transit is not None else self.p_transit_default

        # Calculate P(L_n | Evidence)
        if is_correct:
            # Student answered correctly
            prob_evidence = (p_known * (1 - slip)) + ((1 - p_known) * guess)
            if prob_evidence == 0:
                p_known_given_evidence = 0
            else:
                p_known_given_evidence = (p_known * (1 - slip)) / prob_evidence
        else:
            # Student answered incorrectly
            prob_evidence = (p_known * slip) + ((1 - p_known) * (1 - guess))
            if prob_evidence == 0:
                p_known_given_evidence = 0
            else:
                p_known_given_evidence = (p_known * slip) / prob_evidence

        # Calculate Next State P(L_{n+1})
        new_p_known = p_known_given_evidence + ((1 - p_known_given_evidence) * transit)
        
        # Bound limits
        return max(0.0001, min(0.9999, new_p_known))

    def process_q_matrix_update(self, current_states: Dict[str, float], 
                                q_matrix_weights: Dict[str, float], 
                                is_correct: bool) -> Dict[str, float]:
        """
        Updates multiple concepts based on a Q-Matrix definition.
        q_matrix_weights defines how strongly an item maps to each concept (e.g., {"math": 1.0, "physics": 0.5}).
        Currently treats partial mapping weights as modulating the 'transit' or utilizing evidence partially.
        Simple model: We update all concepts associated with the item. For concepts with lower weights, 
        we diluting the evidence impact by shifting the update closer to the original state.
        """
        new_states = {}
        for concept_id, weight in q_matrix_weights.items():
            current_p = current_states.get(concept_id, 0.1) # Default initial prior
            
            # Full BKT update
            full_updated_p = self.update_p_known(current_p, is_correct)
            
            # Modulate by weight (simple interpolation for partial mapping)
            # If weight = 1.0, full update applied. If weight = 0, no update applied.
            blended_p = current_p + weight * (full_updated_p - current_p)
            new_states[concept_id] = blended_p
            
        return new_states

    def apply_telemetry_fusion(self, 
                             current_p_slip: float, 
                             current_p_transit: float,
                             interaction_type: str,
                             intensity: float = 1.0) -> Tuple[float, float]:
        """
        Dynamically adjusts BKT priors based on interaction telemetry (Soft Evidence).
        
        interaction_type: 
        - 'hint_request': Student asked for Socratic hint. We increase p_slip slightly 
          because they might know it but needed a nudge, and increase p_transit because 
          the hint is a learning opportunity.
        - 'chat_engagement': Deep Socratic chat interaction. Significantly increases p_transit.
        - 'simulation_play': Active interaction with a dynamic component. Reduces p_slip.
        """
        new_slip = current_p_slip
        new_transit = current_p_transit
        
        if interaction_type == 'hint_request':
            # They needed a nudge, maybe they know it but slipped.
            new_slip = min(0.5, current_p_slip + (0.05 * intensity))
            new_transit = min(0.8, current_p_transit + (0.02 * intensity))
            
        elif interaction_type == 'chat_engagement':
            # Deep reflection => high probability of learning
            new_transit = min(0.9, current_p_transit + (0.1 * intensity))
            
        elif interaction_type == 'simulation_play':
            # Active learning reduces careless errors later
            new_slip = max(0.01, current_p_slip - (0.05 * intensity))
            new_transit = min(0.8, current_p_transit + (0.05 * intensity))
            
        elif interaction_type == 'affect_confused':
            # They explicitly indicated confusion (🤔)
            new_slip = min(0.6, current_p_slip + (0.1 * intensity))
            new_transit = max(0.01, current_p_transit - (0.02 * intensity))
            
        elif interaction_type == 'affect_insight':
            # They implicitly indicated a lightbulb moment (💡)
            new_transit = min(0.95, current_p_transit + (0.15 * intensity))
            new_slip = max(0.01, current_p_slip - (0.05 * intensity))
            
        elif interaction_type == 'affect_engaged':
            # Engaged (🤩) indicates flow and focus
            new_transit = min(0.85, current_p_transit + (0.05 * intensity))
            new_slip = max(0.01, current_p_slip - (0.02 * intensity))
            
        elif interaction_type == 'affect_disengaged':
            # Disengaged/bored (🥱) indicates potential for careless errors
            new_slip = min(0.7, current_p_slip + (0.15 * intensity))
            new_transit = max(0.01, current_p_transit - (0.05 * intensity))
            
        return new_slip, new_transit
