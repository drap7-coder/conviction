export interface KnowledgeBookDefinition {
  id: string;
  isbn: string;
  title: string;
  creator: string;
  canonicalUrl: string;
  description: string;
  mark: string;
}

export const KNOWLEDGE_BOOKS: KnowledgeBookDefinition[] = [
  {
    id: "superforecasting",
    isbn: "0804136696",
    title: "Superforecasting",
    creator: "Philip Tetlock & Dan Gardner",
    canonicalUrl: "https://www.amazon.com/Superforecasting-Science-Prediction-Philip-Tetlock/dp/0804136696",
    description:
      "The art and science of prediction. How to quantify uncertainty, weigh competing signals, and calibrate conviction — the theoretical bedrock of evidence-based investing.",
    mark: "SF",
  },
  {
    id: "the-outsiders",
    isbn: "1422162672",
    title: "The Outsiders",
    creator: "William N. Thorndike",
    canonicalUrl: "https://www.amazon.com/Outsiders-Unconventional-Radically-Rational-Blueprint/dp/1422162672",
    description:
      "Eight unconventional CEOs and their radically rational approach to capital allocation. Essential reading for understanding the institutional signals your 13F data is tracking.",
    mark: "OUT",
  },
];
