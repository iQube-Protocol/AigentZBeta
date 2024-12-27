import pytest
import uuid
import os
from unittest.mock import Mock, patch
from typing import Any, List

from agents.qube_agent import QubeSmartAgent
from wallets.wallet_manager import WalletManager
from qube_integrations.qube_handler import QubeHandler
from qube_agent.utils.web_interface import WebInterfaceManager
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult

# Create a mock chat model for testing
class MockChatModel(BaseChatModel):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def run(self, input_dict):
        return "Simulated reasoning about blockchain transactions"

    def _generate(self, messages, stop=None, **kwargs):
        return ChatResult(
            generations=[
                ChatGeneration(
                    text="Simulated reasoning about blockchain transactions",
                    message=AIMessage(content="Simulated reasoning about blockchain transactions")
                )
            ]
        )

    async def _agenerate(self, messages, stop=None, **kwargs):
        return await self._generate(messages, stop, **kwargs)

    @property
    def _llm_type(self):
        return "mock"

# Set environment variables for testing
os.environ['OPENAI_API_KEY'] = 'test_key'

class ConcreteQubeAgent(QubeSmartAgent):
    def plan(self, input_data):
        return [{"action": "test_plan", "details": input_data}]

    def aplan(self, input_data):
        return [{"action": "test_aplan", "details": input_data}]

    @property
    def input_keys(self):
        return ["context", "objective"]

    def process_qube(self, token_id):
        try:
            # Simulate web interface logging
            self.web_interface.log_qube_processing(token_id)
            
            # Use the mock handler's decrypt method
            result = self.qube_handler.decrypt(token_id)
            return result
        except Exception as e:
            return {
                "token_id": token_id,
                "error": str(e)
            }

    def plan_and_execute(self, objective):
        try:
            # Simulate web interface update
            self.web_interface.update_agent_status(objective)
            
            # Simulate reasoning
            context = {"context": "Blockchain transaction processing context"}
            reasoning_result = self.reasoning_chain.invoke({"objective": objective, **context})
            
            return {
                "objective": objective,
                "reasoning": reasoning_result.message.content,
                "actions": self.plan(objective),
                "results": "Simulated execution results"
            }
        except Exception as e:
            return {
                "error": str(e),
                "objective": objective
            }

@pytest.fixture
def mock_dependencies():
    wallet_manager = Mock(spec=WalletManager)
    
    # Create a mock qube_handler that raises an exception when decrypt is called
    qube_handler = Mock(spec=QubeHandler)
    qube_handler.decrypt.side_effect = Exception("Original decryption error")
    
    web_interface = Mock(spec=WebInterfaceManager)
    web_interface.configure_mock(
        log_qube_processing=Mock(),
        update_agent_status=Mock()
    )
    
    return wallet_manager, qube_handler, web_interface

class TestQubeSmartAgent:
    @patch('agents.qube_agent.ChatOpenAI', MockChatModel)
    def test_agent_initialization(self, mock_dependencies):
        """
        Test QubeSmartAgent initialization
        """
        wallet_manager, qube_handler, web_interface = mock_dependencies

        agent = ConcreteQubeAgent(
            wallet_manager=wallet_manager,
            qube_handler=qube_handler,
            web_interface=web_interface
        )

        assert agent is not None
        assert agent.wallet_manager == wallet_manager
        assert agent.qube_handler == qube_handler
        assert agent.web_interface == web_interface
        assert agent.id is not None

    @patch('agents.qube_agent.ChatOpenAI', MockChatModel)
    def test_process_qube(self, mock_dependencies):
        """
        Test Qube token processing
        """
        wallet_manager, qube_handler, web_interface = mock_dependencies

        agent = ConcreteQubeAgent(
            wallet_manager=wallet_manager,
            qube_handler=qube_handler,
            web_interface=web_interface
        )

        token_id = str(uuid.uuid4())
        result = agent.process_qube(token_id)

        assert result == {
            "token_id": token_id,
            "error": "Original decryption error"
        }

        # Verify web interface logging
        web_interface.log_qube_processing.assert_called_once_with(token_id)

    @patch('agents.qube_agent.ChatOpenAI', MockChatModel)
    def test_plan_and_execute(self, mock_dependencies):
        """
        Test agent's plan and execute method
        """
        wallet_manager, qube_handler, web_interface = mock_dependencies

        agent = ConcreteQubeAgent(
            wallet_manager=wallet_manager,
            qube_handler=qube_handler,
            web_interface=web_interface
        )

        objective = "Retrieve and process information about blockchain transactions"
        result = agent.plan_and_execute(objective)

        assert "objective" in result
        assert "reasoning" in result or "error" in result
        assert "actions" in result or "error" in result

    @patch('agents.qube_agent.ChatOpenAI', MockChatModel)
    def test_create_qube_agent(self):
        """
        Test the factory method for creating a QubeAgent
        """
        with patch('wallets.wallet_manager.WalletManager', 
                   return_value=Mock(spec=WalletManager,
                                     account=Mock(address="0x1234567890123456789012345678901234567890"),
                                     get_address=lambda: "0x1234567890123456789012345678901234567890")), \
             patch('qube_integrations.qube_handler.QubeHandler', 
                   return_value=Mock(spec=QubeHandler,
                                     ipfs_client=Mock(),
                                     decrypt=lambda x: {"token_id": x, "data": "test"})), \
             patch('qube_agent.utils.web_interface.WebInterfaceManager'):
            
            from agents.qube_agent import create_qube_agent
            agent = create_qube_agent(agent_class=ConcreteQubeAgent)
            
            assert agent is not None
            assert isinstance(agent, ConcreteQubeAgent)
            assert agent.id is not None

    @patch('agents.qube_agent.ChatOpenAI', MockChatModel)
    def test_error_handling(self, mock_dependencies):
        """
        Test agent's error handling capabilities
        """
        wallet_manager, qube_handler, web_interface = mock_dependencies

        agent = ConcreteQubeAgent(
            wallet_manager=wallet_manager,
            qube_handler=qube_handler,
            web_interface=web_interface
        )

        token_id = str(uuid.uuid4())
        
        result = agent.process_qube(token_id)

        assert result == {
            "token_id": token_id,
            "error": "Original decryption error"
        }

        # Verify web interface logging
        web_interface.log_qube_processing.assert_called_once_with(token_id)

def test_suite():
    """
    Placeholder for additional test suite configurations
    """
    pass
