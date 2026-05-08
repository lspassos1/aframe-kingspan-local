import { beforeEach, describe, expect, it } from "vitest";
import { defaultProject } from "@/data/defaultProject";
import { cloneProject } from "@/lib/store/project-normalization";
import { useProjectStore } from "@/lib/store/project-store";

function resetStoreForTest() {
  useProjectStore.setState({
    project: cloneProject(defaultProject),
    savedProjects: [],
    projectHydrationStatus: "loaded",
  });
}

describe("project store hydration recovery", () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  it("recovers from an invalid hydration state when setting a fresh project", () => {
    useProjectStore.getState().setProjectHydrationStatus("invalid");

    useProjectStore.getState().setProject({
      ...cloneProject(defaultProject),
      id: "fresh-project",
      onboardingCompleted: true,
    });

    expect(useProjectStore.getState().project.id).toBe("fresh-project");
    expect(useProjectStore.getState().projectHydrationStatus).toBe("loaded");
  });

  it("recovers from an invalid hydration state when importing a project", () => {
    useProjectStore.getState().setProjectHydrationStatus("invalid");

    useProjectStore.getState().importProject({
      ...cloneProject(defaultProject),
      id: "imported-project",
      onboardingCompleted: true,
    });

    expect(useProjectStore.getState().project.id).toBe("imported-project");
    expect(useProjectStore.getState().savedProjects.some((project) => project.id === "imported-project")).toBe(true);
    expect(useProjectStore.getState().projectHydrationStatus).toBe("loaded");
  });

  it("recovers when onboarding completion creates a usable project after hydration failure", () => {
    useProjectStore.getState().setProjectHydrationStatus("invalid");

    useProjectStore.getState().setOnboardingCompleted(true);

    expect(useProjectStore.getState().project.onboardingCompleted).toBe(true);
    expect(useProjectStore.getState().projectHydrationStatus).toBe("loaded");
  });

  it("recovers when opening a saved project after hydration failure", () => {
    const savedProject = { ...cloneProject(defaultProject), id: "saved-project", onboardingCompleted: true };
    useProjectStore.setState({ savedProjects: [savedProject], projectHydrationStatus: "invalid" });

    useProjectStore.getState().openSavedProject("saved-project");

    expect(useProjectStore.getState().project.id).toBe("saved-project");
    expect(useProjectStore.getState().projectHydrationStatus).toBe("loaded");
  });
});
