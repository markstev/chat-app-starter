"use client";

import { useState } from "react";
import { trpc } from "../../utils/trpc";

export default function TRPCDemo() {
  const [helloInput, setHelloInput] = useState("World");
  const [userId, setUserId] = useState("1");
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postAuthorId, setPostAuthorId] = useState("1");
  const [isSubscribed, setIsSubscribed] = useState(false);

  // tRPC queries and mutations
  const helloQuery = trpc.hello.useQuery({ text: helloInput });
  const userQuery = trpc.getUser.useQuery({ id: userId });
  const postsQuery = trpc.getPosts.useQuery({ limit: 5, offset: 0 });

  // SSE subscription
  const countSubscription = trpc.countStream.useSubscription(undefined, {
    enabled: isSubscribed,
    onData: (data) => {
      // Data is handled automatically by the subscription
    },
    onError: (err) => {
      console.error("Subscription error:", err);
    },
  });

  const createPostMutation = trpc.createPost.useMutation({
    onSuccess: () => {
      // Refetch posts after creating a new one
      postsQuery.refetch();
      setPostTitle("");
      setPostContent("");
    },
  });

  const handleCreatePost = () => {
    if (postTitle && postContent) {
      createPostMutation.mutate({
        title: postTitle,
        content: postContent,
        authorId: postAuthorId,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            tRPC Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            This page demonstrates tRPC functionality with queries and
            mutations.
          </p>

          {/* Hello Query Demo */}
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">
              Hello Query Demo
            </h2>
            <div className="flex gap-4 items-center mb-4">
              <input
                type="text"
                value={helloInput}
                onChange={(e) => setHelloInput(e.target.value)}
                placeholder="Enter a name"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={() => helloQuery.refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded border">
              {helloQuery.isLoading && (
                <p className="text-gray-500">Loading...</p>
              )}
              {helloQuery.error && (
                <p className="text-red-500">
                  Error: {helloQuery.error.message}
                </p>
              )}
              {helloQuery.data && (
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {helloQuery.data.greeting}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Timestamp: {helloQuery.data.timestamp}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* User Query Demo */}
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-4">
              User Query Demo
            </h2>
            <div className="flex gap-4 items-center mb-4">
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="User ID"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={() => userQuery.refetch()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Fetch User
              </button>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded border">
              {userQuery.isLoading && (
                <p className="text-gray-500">Loading...</p>
              )}
              {userQuery.error && (
                <p className="text-red-500">Error: {userQuery.error.message}</p>
              )}
              {userQuery.data && (
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {userQuery.data.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Email: {userQuery.data.email}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created: {userQuery.data.createdAt}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Create Post Mutation Demo */}
          <div className="mb-8 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h2 className="text-xl font-semibold text-purple-900 dark:text-purple-100 mb-4">
              Create Post Mutation Demo
            </h2>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Post title"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content
                </label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Post content"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Author ID
                </label>
                <input
                  type="text"
                  value={postAuthorId}
                  onChange={(e) => setPostAuthorId(e.target.value)}
                  placeholder="Author ID"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <button
              onClick={handleCreatePost}
              disabled={
                createPostMutation.isPending || !postTitle || !postContent
              }
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPostMutation.isPending ? "Creating..." : "Create Post"}
            </button>
            {createPostMutation.error && (
              <p className="text-red-500 mt-2">
                Error: {createPostMutation.error.message}
              </p>
            )}
            {createPostMutation.data && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded border">
                <p className="text-green-600 dark:text-green-400 font-medium">
                  Post created successfully!
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ID: {createPostMutation.data.post.id}
                </p>
              </div>
            )}
          </div>

          {/* Posts List Demo */}
          <div className="mb-8 p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <h2 className="text-xl font-semibold text-orange-900 dark:text-orange-100 mb-4">
              Posts List Query Demo
            </h2>
            <div className="mb-4">
              <button
                onClick={() => postsQuery.refetch()}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                Refresh Posts
              </button>
            </div>
            <div className="space-y-4">
              {postsQuery.isLoading && (
                <p className="text-gray-500">Loading posts...</p>
              )}
              {postsQuery.error && (
                <p className="text-red-500">
                  Error: {postsQuery.error.message}
                </p>
              )}
              {postsQuery.data && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Showing {postsQuery.data.posts.length} of{" "}
                    {postsQuery.data.total} posts
                  </p>
                  <div className="space-y-3">
                    {postsQuery.data.posts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 bg-white dark:bg-gray-800 rounded border"
                      >
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {post.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {post.content}
                        </p>
                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>Author: {post.user_id}</span>
                          <span>
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SSE Subscription Demo */}
          <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <h2 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100 mb-4">
              Server-Sent Events (SSE) Subscription Demo
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This demonstrates real-time updates using Server-Sent Events. The
              backend counts +1 every 200ms and sends the updated count to the
              frontend.
            </p>
            <div className="mb-4">
              <button
                onClick={() => setIsSubscribed(!isSubscribed)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  isSubscribed
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {isSubscribed ? "Stop Subscription" : "Start Subscription"}
              </button>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded border">
              {!isSubscribed && (
                <p className="text-gray-500">
                  Click "Start Subscription" to begin receiving updates
                </p>
              )}
              {isSubscribed && countSubscription.status === "connecting" && (
                <p className="text-blue-500">Connecting to subscription...</p>
              )}
              {isSubscribed && countSubscription.status === "error" && (
                <p className="text-red-500">
                  Error: {countSubscription.error?.message || "Unknown error"}
                </p>
              )}
              {isSubscribed && countSubscription.data && (
                <div>
                  <div className="mb-2">
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {countSubscription.data.count}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last update:{" "}
                    {new Date(
                      countSubscription.data.timestamp
                    ).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Status: {countSubscription.status}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
