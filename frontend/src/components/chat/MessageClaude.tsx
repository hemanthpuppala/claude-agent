import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCard } from "./ToolCard";
import { ToolResult } from "./ToolResult";
import { AskUserQuestion } from "./AskUserQuestion";
import type { AssistantMsg, ContentBlock } from "@/lib/types";

export function MessageClaude({ message }: { message: AssistantMsg }) {
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {message.content.map((block, i) => (
          <ContentBlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return (
        <div className="claude-markdown" style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text)" }}>
          <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
            {block.text || ""}
          </ReactMarkdown>
        </div>
      );

    case "thinking":
      return <ThinkingBlock text={block.thinking || ""} />;

    case "tool_use": {
      const name = block.name || "Unknown";
      // Hide internal SDK tools
      if (name === "ToolSearch" || name === "ListMcpResourcesTool" || name === "ReadMcpResourceTool") return null;
      // AskUserQuestion gets a special interactive renderer
      if (name === "AskUserQuestion") {
        return <AskUserQuestion input={block.input || {}} />;
      }
      return (
        <ToolCard
          toolName={name}
          toolInput={block.input || {}}
          toolId={block.id || ""}
        />
      );
    }

    case "tool_result": {
      const content = block.content || "";
      // Hide empty tool results (e.g. from internal tool_reference responses)
      if (!content || content.trim() === "") return null;
      return (
        <ToolResult
          content={content}
          isError={block.is_error || false}
        />
      );
    }

    default:
      return null;
  }
}
