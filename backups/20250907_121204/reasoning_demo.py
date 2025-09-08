import os
from qube_agent.reasoning.advanced_reasoning import AdvancedReasoningEngine

# Ensure OpenAI API key is set
if 'OPENAI_API_KEY' not in os.environ:
    print("Please set the OPENAI_API_KEY environment variable.")
    exit(1)

def main():
    # Initialize the Advanced Reasoning Engine
    reasoning_engine = AdvancedReasoningEngine()
    
    # Demonstrate Objective Decomposition
    print("\n--- Objective Decomposition ---")
    complex_objective = "Develop a decentralized AI agent framework that integrates blockchain technology"
    decomposed_plan = reasoning_engine.decompose_objective(complex_objective)
    print(decomposed_plan)
    
    # Demonstrate Context Synthesis
    print("\n--- Context Synthesis ---")
    initial_context = {
        "project": "QubeAgent",
        "current_focus": "AI Reasoning"
    }
    new_info = {
        "emerging_tech": "Multi-agent systems",
        "challenges": "Interoperability and communication"
    }
    synthesized_context = reasoning_engine.synthesize_context(
        current_context=initial_context, 
        new_information=new_info
    )
    print(f"Context ID: {synthesized_context['context_id']}")
    print(synthesized_context['synthesized_context'])
    
    # Demonstrate Multi-Agent Reasoning
    print("\n--- Multi-Agent Reasoning ---")
    agent_perspectives = [
        {
            "agent_type": "Blockchain Specialist",
            "perspective": "Focus on secure, decentralized transaction processing"
        },
        {
            "agent_type": "AI Researcher",
            "perspective": "Implement advanced machine learning models for decision-making"
        },
        {
            "agent_type": "Security Expert",
            "perspective": "Ensure robust encryption and access control"
        }
    ]
    multi_agent_result = reasoning_engine.multi_agent_reasoning(agent_perspectives)
    print(multi_agent_result)

if __name__ == "__main__":
    main()
