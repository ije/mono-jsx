import { Result, Ok, Err, Post } from "./types.ts";

export const fetchPostsByUser = async (userId: string): Promise<Result<Post[]>> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    return Ok([
      {
        id: "1",
        title: "Introduction to Functional Programming",
        content: "FP is a programming paradigm that treats computation as evaluation of mathematical functions...",
        authorId: userId,
        createdAt: new Date("2024-01-15"),
      },
      {
        id: "2",
        title: "Type-Driven Development with TypeScript",
        content: "Using TypeScript's type system to guide software design and implementation...",
        authorId: userId,
        createdAt: new Date("2024-02-20"),
      },
    ]);
  } catch (error) {
    return Err(error as Error);
  }
};