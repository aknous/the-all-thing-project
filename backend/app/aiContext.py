# app/aiContext.py
"""
AI-powered poll context generation service.
Uses OpenAI to generate neutral, educational background information for polls.
"""

from typing import Optional
from openai import AsyncOpenAI
from .settings import settings
from .logger import logger


SYSTEM_PROMPT = """You are a neutral, educational assistant that provides factual context for poll questions.

Your task is to provide background information that helps voters understand the poll question without bias.

Guidelines:
- Stay completely neutral and objective
- Provide factual background and key perspectives
- Include relevant definitions if needed
- Be CONCISE and direct - aim for 150-250 words maximum
- Use markdown formatting sparingly (bold for emphasis, short lists only)
- Do NOT advocate for any particular option
- Do NOT make predictions about voting outcomes
- Focus on helping voters make informed decisions
- Avoid unnecessary elaboration or tangents

Format your response as markdown text. Keep it brief and focused."""


async def generatePollContext(
    title: str,
    question: Optional[str],
    optionLabels: list[str]
) -> str:
    """
    Generate AI-powered context for a poll using OpenAI.
    
    Args:
        title: Poll title
        question: Optional poll question (may be None)
        optionLabels: List of option labels for the poll
        
    Returns:
        Markdown-formatted context text
        
    Raises:
        ValueError: If OpenAI API key is not configured
        Exception: If API call fails
    """
    api_key = settings.openai_api_key
    if not api_key:
        raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.")

    model = settings.openai_model
    
    # Build user prompt
    user_prompt = f"""Generate neutral, educational context for this poll:

Title: {title}
"""
    
    if question:
        user_prompt += f"Question: {question}\n"
    
    user_prompt += f"\nOptions:\n"
    for i, label in enumerate(optionLabels, 1):
        user_prompt += f"{i}. {label}\n"
    
    user_prompt += "\nProvide concise, factual background that helps voters understand this poll question. Use markdown formatting and cite sources when possible."
    
    # Call OpenAI API
    try:
        client = AsyncOpenAI(api_key=api_key, timeout=60.0)
        response = await client.responses.create(
            model=model,
            tools=[
                {"type": "web_search"},
            ],
            instructions=SYSTEM_PROMPT,
            input=user_prompt,
            temperature=.5,
            max_output_tokens=900
        )

        status = getattr(response, "status", None)
        incomplete_details = getattr(response, "incomplete_details", None)
        usage = getattr(response, "usage", None)

        # SDK provides output_text when available.
        content = (getattr(response, "output_text", None) or "").strip()
        if not content:
            # Fallback: try to extract any output_text items from the response.
            try:
                dumped = response.model_dump()
                parts: list[str] = []
                for item in dumped.get("output", []) or []:
                    if item.get("type") != "message":
                        continue
                    for c in item.get("content", []) or []:
                        if c.get("type") == "output_text" and c.get("text"):
                            parts.append(c["text"])
                content = "\n".join(parts).strip()
            except Exception:
                content = ""

        if not content:
            # Don't spam logs with full content, but include enough to debug.
            try:
                dumped = response.model_dump()
                logger.error(
                    "OpenAI returned empty output_text. model=%s response_keys=%s",
                    model,
                    sorted(list(dumped.keys())),
                )
            except Exception:
                logger.error("OpenAI returned empty output_text. model=%s", model)
            raise Exception("OpenAI returned empty content")

        if incomplete_details:
            logger.warning(
                "OpenAI response incomplete. model=%s status=%s incomplete_details=%s usage=%s",
                model,
                status,
                incomplete_details,
                usage,
            )

        logger.info(
            "Generated AI context for poll '%s' (%s chars) using model '%s' (status=%s usage=%s)",
            title,
            len(content),
            model,
            status,
            usage,
        )
        return content

    except Exception as e:
        logger.error(f"Failed to generate AI context: {str(e)}")
        raise
