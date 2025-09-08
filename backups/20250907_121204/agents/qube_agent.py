from typing import Any, Dict, List, Optional, Union
import uuid
import json

from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain.chat_models import ChatOpenAI
from langchain_core.messages import AIMessage

from wallets.wallet_manager import WalletManager
from qube_integrations.qube_handler import QubeHandler
from qube_agent.utils.web_interface import WebInterfaceManager
from qube_agent.reasoning.advanced_reasoning import AdvancedReasoningEngine

from qube_agent.models.iqube import (
    DataQube, 
    ContentQube, 
    AgentQube, 
    MetaQube, 
    BlakQube, 
    IQubeType
)

class QubeSmartAgent:
    def __init__(self, 
                 wallet_manager: WalletManager,
                 qube_handler: QubeHandler,
                 web_interface: WebInterfaceManager,
                 llm: Optional[Any] = None):
        self.id = str(uuid.uuid4())
        self.wallet_manager = wallet_manager
        self.qube_handler = qube_handler
        self.web_interface = web_interface
        
        # Use provided LLM or default to ChatOpenAI
        self.llm = llm or ChatOpenAI(temperature=0.7)
        
        # Create reasoning prompt template
        reasoning_template = """
        Given the objective: {objective}
        Provide a detailed reasoning strategy for processing blockchain transactions.
        
        Reasoning Strategy:
        """
        reasoning_prompt = PromptTemplate(
            input_variables=["objective"],
            template=reasoning_template
        )
        
        # Create reasoning chain
        self.reasoning_chain = LLMChain(
            llm=self.llm,
            prompt=reasoning_prompt
        )

    @property
    def input_keys(self):
        return ["context", "objective"]

    def plan(self, input_data):
        raise NotImplementedError("Subclass must implement plan method")

    def aplan(self, input_data):
        raise NotImplementedError("Subclass must implement aplan method")

    def process_qube(self, token_id):
        try:
            # Simulate web interface logging
            self.web_interface.log_qube_processing(token_id)
            
            # Explicitly call decrypt and handle potential exceptions
            try:
                result = self.qube_handler.decrypt(token_id)
            except Exception as decrypt_error:
                # Re-raise the original exception
                raise
        except Exception as e:
            # Log the error and re-raise
            self.web_interface.log_qube_processing(token_id, error=str(e))
            raise

    def plan_and_execute(self, objective):
        raise NotImplementedError("Subclass must implement plan_and_execute method")

class QubeAgent:
    def __init__(self, debug: bool = False):
        """
        Initialize QubeAgent with context memory and debug mode
        
        Args:
            debug: Enable debug mode for additional logging
        """
        self.debug = debug
        
        # Context memory to store processed iQubes
        self.context_memory: Dict[str, Any] = {
            'data_qubes': {},
            'content_qubes': {},
            'agent_qubes': {},
            'context_summary': {
                'domains': set(),
                'skills': set(),
                'interests': set(),
                'trust_scores': []
            }
        }
        
        self.web_interface = WebInterfaceManager(debug=debug)
        self.reasoning_engine = AdvancedReasoningEngine()
        
        # Create agent dashboard
        self.agent_id = self.web_interface.create_agent_dashboard(
            agent_id=None, 
            initial_config={
                "reasoning_mode": "iQube-enhanced",
                "context_tracking": True
            }
        )
    
    def process_iqube(self, iqube: Union[DataQube, ContentQube, AgentQube]) -> Dict[str, Any]:
        """
        Process an iQube and update the agent's context memory
        
        Args:
            iqube: iQube to process
        
        Returns:
            Context update details
        """
        context_update = {
            'iqube_id': iqube.meta.id,
            'iqube_type': str(type(iqube).__name__),
            'changes': []
        }
        
        # Process based on iQube type
        if isinstance(iqube, DataQube):
            self._process_data_qube(iqube, context_update)
        elif isinstance(iqube, ContentQube):
            self._process_content_qube(iqube, context_update)
        elif isinstance(iqube, AgentQube):
            self._process_agent_qube(iqube, context_update)
        
        # Update context summary
        self._update_context_summary(iqube, context_update)
        
        if self.debug:
            print(f"Processed iQube: {context_update}")
        
        return context_update
    
    def _process_data_qube(self, data_qube: DataQube, context_update: Dict[str, Any]):
        """
        Process a DataQube and extract relevant context
        
        Args:
            data_qube: DataQube to process
            context_update: Dictionary to update with context changes
        """
        # Store the DataQube in context memory
        self.context_memory['data_qubes'][data_qube.meta.id] = data_qube
        
        # Extract context from BlakQube data
        blak_data = data_qube.blak.data
        
        # Example context extraction strategies
        if 'occupation' in blak_data:
            context_update['changes'].append({
                'domain': blak_data['occupation'],
                'type': 'professional_context'
            })
        
        if 'skills' in blak_data:
            context_update['changes'].append({
                'skills': blak_data['skills'],
                'type': 'skill_update'
            })
        
        if 'professionalInterests' in blak_data:
            context_update['changes'].append({
                'interests': blak_data['professionalInterests'],
                'type': 'interest_update'
            })
    
    def _process_content_qube(self, content_qube: ContentQube, context_update: Dict[str, Any]):
        """
        Process a ContentQube and extract relevant context
        
        Args:
            content_qube: ContentQube to process
            context_update: Dictionary to update with context changes
        """
        # Store the ContentQube in context memory
        self.context_memory['content_qubes'][content_qube.meta.id] = content_qube
        
        # Extract context from BlakQube metadata
        blak_data = content_qube.blak.data
        
        # Example context extraction for research papers
        if 'title' in blak_data:
            context_update['changes'].append({
                'research_topic': blak_data['title'],
                'type': 'research_context'
            })
        
        if 'publication' in blak_data:
            context_update['changes'].append({
                'publication': blak_data['publication'],
                'type': 'publication_context'
            })
    
    def _process_agent_qube(self, agent_qube: AgentQube, context_update: Dict[str, Any]):
        """
        Process an AgentQube and extract relevant context
        
        Args:
            agent_qube: AgentQube to process
            context_update: Dictionary to update with context changes
        """
        # Store the AgentQube in context memory
        self.context_memory['agent_qubes'][agent_qube.meta.id] = agent_qube
        
        # Extract context from agent metadata
        context_update['changes'].append({
            'agent_name': agent_qube.name,
            'capabilities': agent_qube.capabilities,
            'type': 'agent_context'
        })
    
    def _update_context_summary(self, iqube: Union[DataQube, ContentQube, AgentQube], context_update: Dict[str, Any]):
        """
        Update the overall context summary based on processed iQube
        
        Args:
            iqube: Processed iQube
            context_update: Context update details
        """
        # Update domains
        for change in context_update.get('changes', []):
            if 'domain' in change:
                self.context_memory['context_summary']['domains'].add(change['domain'])
            
            if 'skills' in change:
                self.context_memory['context_summary']['skills'].update(change['skills'])
            
            if 'interests' in change:
                self.context_memory['context_summary']['interests'].update(change['interests'])
        
        # Add trust score
        self.context_memory['context_summary']['trust_scores'].append(iqube.meta.trust_score)
    
    def get_context_summary(self) -> Dict[str, Any]:
        """
        Retrieve a summary of the agent's current context
        
        Returns:
            Context summary dictionary
        """
        # Convert sets to lists for JSON serialization
        summary = self.context_memory['context_summary'].copy()
        summary['domains'] = list(summary['domains'])
        summary['skills'] = list(summary['skills'])
        summary['interests'] = list(summary['interests'])
        
        return summary
    
    def process_iqube_tokens(
        self, 
        iqube_tokens: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process iQube tokens with advanced reasoning and track context.
        
        Args:
            iqube_tokens: List of iQube tokens to process
        
        Returns:
            Synthesized context with strategic insights
        """
        # Synthesize context from iQube tokens
        synthesized_context = self.reasoning_engine.synthesize_context_with_iqubes(
            iqube_tokens=iqube_tokens
        )
        
        # Log token processing with strategic insights
        for token in iqube_tokens:
            self.web_interface.log_qube_processing(
                token_id=token.get('token_id', 'unknown'),
                data=token,
                strategic_insights=synthesized_context.get('strategic_recommendations', [])
            )
        
        # Update agent status with context
        self.web_interface.update_agent_status(
            agent_id=self.agent_id,
            objective="iQube Token Processing",
            results=synthesized_context,
            iqube_context=synthesized_context
        )
        
        return synthesized_context
    
    def decompose_objective(
        self, 
        objective: str, 
        iqube_tokens: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Decompose an objective using iQube-enhanced reasoning.
        
        Args:
            objective: The objective to decompose
            iqube_tokens: iQube tokens to inform reasoning
        
        Returns:
            Decomposed objective plan
        """
        # Decompose objective with iQube context
        decomposed_plan = self.reasoning_engine.decompose_objective_with_iqubes(
            objective, 
            iqube_tokens
        )
        
        # Update agent status
        self.web_interface.update_agent_status(
            agent_id=self.agent_id,
            objective=objective,
            results=decomposed_plan,
            iqube_context=decomposed_plan
        )
        
        return decomposed_plan
    
    def get_dashboard(self) -> Dict[str, Any]:
        """
        Retrieve the agent's dashboard with comprehensive tracking.
        
        Returns:
            Agent dashboard with iQube context layers and insights
        """
        return self.web_interface.get_agent_dashboard(self.agent_id)

def create_qube_agent(agent_class=None):
    """
    Factory method to create a QubeAgent with default or custom dependencies
    """
    from wallets.wallet_manager import WalletManager
    from qube_integrations.qube_handler import QubeHandler
    from qube_agent.utils.web_interface import WebInterfaceManager

    # Create default dependencies
    wallet_manager = WalletManager()
    qube_handler = QubeHandler()
    web_interface = WebInterfaceManager()

    # Use the provided agent class or a default implementation
    if agent_class is None:
        from agents.qube_agent import ConcreteQubeAgent
        agent_class = ConcreteQubeAgent

    # Create and return the agent
    return agent_class(
        wallet_manager=wallet_manager,
        qube_handler=qube_handler,
        web_interface=web_interface
    )

class ConcreteQubeAgent(QubeSmartAgent):
    def plan(self, input_data):
        return [{"action": "test_plan", "details": input_data}]

    def aplan(self, input_data):
        return [{"action": "test_aplan", "details": input_data}]

    def process_qube(self, token_id):
        try:
            # Simulate web interface logging
            self.web_interface.log_qube_processing(token_id)
            
            # Explicitly call decrypt and handle potential exceptions
            try:
                result = self.qube_handler.decrypt(token_id)
            except Exception as decrypt_error:
                # Re-raise the original exception
                raise
        except Exception as e:
            # Log the error and re-raise
            self.web_interface.log_qube_processing(token_id, error=str(e))
            raise

    def plan_and_execute(self, objective):
        try:
            # Simulate web interface update
            self.web_interface.update_agent_status(objective)
            
            # Simulate reasoning
            context = {"context": "Blockchain transaction processing context"}
            reasoning_result = self.reasoning_chain.run({"objective": objective, **context})
            
            return {
                "objective": objective,
                "reasoning": reasoning_result,
                "actions": self.plan(objective),
                "results": "Simulated execution results"
            }
        except Exception as e:
            return {
                "objective": objective,
                "reasoning": str(e),
                "error": str(e)
            }
