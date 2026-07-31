import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListEditor, type ListItem } from "@/components/ListEditor";

// jsdom doesn't implement HTMLDialogElement.showModal/close (they're no-ops
// that throw "Not implemented"), so Sheet's effect would blow up on mount.
// Stub the minimal behaviour Sheet actually relies on: flipping `.open` and
// not throwing. Same approach as tests/unit/CaptureSheet.test.tsx.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const items: ListItem[] = [
  { id: "a", name: "SMASHED" },
  { id: "b", name: "PERSONAL", blocked: "ARCHIVING KEEPS THE TAG ON 2 EXISTING TASKS" },
  { id: "c", name: "OPS" },
];

const noop = () => {};

describe("ListEditor", () => {
  it("renders every item with its name", () => {
    render(
      <ListEditor items={items} onRename={noop} onReorder={noop} onAdd={noop} onArchive={noop} />,
    );
    expect(screen.getByText("SMASHED")).toBeInTheDocument();
    expect(screen.getByText("PERSONAL")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();
  });

  it("disables the up arrow on the first row and the down arrow on the last", () => {
    render(
      <ListEditor items={items} onRename={noop} onReorder={noop} onAdd={noop} onArchive={noop} />,
    );
    expect(screen.getByRole("button", { name: "Move SMASHED up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move SMASHED down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move OPS down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move OPS up" })).toBeEnabled();
  });

  it("calls onReorder with the row's id and -1 on up, and 1 on down", async () => {
    const onReorder = vi.fn();
    render(
      <ListEditor
        items={items}
        onRename={noop}
        onReorder={onReorder}
        onAdd={noop}
        onArchive={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Move PERSONAL up" }));
    expect(onReorder).toHaveBeenCalledWith("b", -1);

    await userEvent.click(screen.getByRole("button", { name: "Move PERSONAL down" }));
    expect(onReorder).toHaveBeenCalledWith("b", 1);
  });

  it("opens the sheet pre-filled with the row's name via the edit control, and saving calls onRename with the id and uppercased name", async () => {
    const onRename = vi.fn();
    render(
      <ListEditor
        items={items}
        onRename={onRename}
        onReorder={noop}
        onAdd={noop}
        onArchive={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit SMASHED" }));
    const input = screen.getByLabelText("Name");
    expect(input).toHaveValue("SMASHED");

    await userEvent.clear(input);
    await userEvent.type(input, "renamed project");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));

    expect(onRename).toHaveBeenCalledWith("a", "RENAMED PROJECT");
  });

  it("opens an empty sheet via +, and saving calls onAdd with the uppercased name", async () => {
    const onAdd = vi.fn();
    render(
      <ListEditor items={items} onRename={noop} onReorder={noop} onAdd={onAdd} onArchive={noop} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByLabelText("Name")).toHaveValue("");

    await userEvent.type(screen.getByLabelText("Name"), "new tag");
    await userEvent.click(screen.getByRole("button", { name: "SAVE" }));

    expect(onAdd).toHaveBeenCalledWith("NEW TAG");
  });

  it("disables SAVE while the field is empty or whitespace", async () => {
    render(
      <ListEditor items={items} onRename={noop} onReorder={noop} onAdd={noop} onArchive={noop} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    const save = screen.getByRole("button", { name: "SAVE" });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "   ");
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "x");
    expect(save).toBeEnabled();
  });

  it("calls onArchive with the id when ARCHIVE is pressed", async () => {
    const onArchive = vi.fn();
    render(
      <ListEditor
        items={items}
        onRename={noop}
        onReorder={noop}
        onAdd={noop}
        onArchive={onArchive}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit OPS" }));
    await userEvent.click(screen.getByRole("button", { name: "ARCHIVE" }));
    expect(onArchive).toHaveBeenCalledWith("c");
  });

  it("renders the blocked text when editing an item that has it, and omits it for one that doesn't", async () => {
    render(
      <ListEditor items={items} onRename={noop} onReorder={noop} onAdd={noop} onArchive={noop} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit PERSONAL" }));
    expect(
      screen.getByText("ARCHIVING KEEPS THE TAG ON 2 EXISTING TASKS"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Edit SMASHED" }));
    expect(
      screen.queryByText("ARCHIVING KEEPS THE TAG ON 2 EXISTING TASKS"),
    ).not.toBeInTheDocument();
  });
});
