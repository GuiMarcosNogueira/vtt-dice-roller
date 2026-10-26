import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ReviewModal } from "../app/components/ReviewModal";
import { SettingsModal } from "../app/components/SettingsModal";
import { RecentRolls } from "../app/components/RecentRolls";
import { DEFAULT_SETTINGS, RecognitionResult, RollEvent } from "../app/types";

describe("ReviewModal Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={null}
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Lendo dado com IA...")).toBeInTheDocument();
  });

  it("renders empty image placeholder if imageSrc is null", () => {
    render(
      <ReviewModal
        imageSrc={null}
        result={null}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Sem imagem capturada")).toBeInTheDocument();
  });

  it("displays recognized result and allows quick number adjustment", () => {
    const mockResult: RecognitionResult = {
      die_type: "d20",
      value: 15,
      confidence: 0.95,
      raw_explanation: "Face 15 no topo.",
    };

    const onConfirmMock = vi.fn();
    const onCancelMock = vi.fn();

    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={mockResult}
        isLoading={false}
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />
    );

    expect(screen.getByText("d20")).toBeInTheDocument();
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Face 15 no topo/)).toBeInTheDocument();

    // Clica no botão do número 20 para corrigir
    const num20Btn = screen.getByRole("button", { name: "20" });
    fireEvent.click(num20Btn);

    // Confirma
    const confirmBtn = screen.getByText(/Confirmar & Enviar VTT/);
    fireEvent.click(confirmBtn);

    expect(onConfirmMock).toHaveBeenCalledWith("d20", 20);
  });

  it("supports d100 with tens increments", () => {
    const mockResult: RecognitionResult = {
      die_type: "d100",
      value: 70,
      confidence: 0.9,
    };

    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={mockResult}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("d100")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "70" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0" })).toBeInTheDocument();
  });

  it("falls back to 20 buttons if die type is unknown", () => {
    const mockResult = {
      die_type: "d30" as unknown as DieType,
      value: 12,
      confidence: 0.8,
    };

    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={mockResult}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
  });

  it("handles cancel button and close button", () => {
    const onCancelMock = vi.fn();

    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={null}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={onCancelMock}
      />
    );

    const discardBtn = screen.getByText("Descartar");
    fireEvent.click(discardBtn);
    expect(onCancelMock).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByText("✕");
    fireEvent.click(closeBtn);
    expect(onCancelMock).toHaveBeenCalledTimes(2);
  });

  it("triggers autoSend on countdown completion", () => {
    const mockResult: RecognitionResult = {
      die_type: "d20",
      value: 18,
      confidence: 0.98,
    };
    const onConfirmMock = vi.fn();

    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={mockResult}
        isLoading={false}
        onConfirm={onConfirmMock}
        onCancel={vi.fn()}
        autoSend={true}
        autoSendDelayMs={1000}
      />
    );

    expect(onConfirmMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(onConfirmMock).toHaveBeenCalledWith("d20", 18);
  });
});

describe("SettingsModal Component", () => {
  it("renders form inputs with initial settings and saves on submit", () => {
    const onSaveMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <SettingsModal
        settings={DEFAULT_SETTINGS}
        onSave={onSaveMock}
        onClose={onCloseMock}
      />
    );

    const apiInput = screen.getByPlaceholderText("http://localhost:8000");
    fireEvent.change(apiInput, { target: { value: "http://192.168.1.100:8000" } });

    const playerInput = screen.getByPlaceholderText("Jogador");
    fireEvent.change(playerInput, { target: { value: "Legolas" } });

    const autoSendCheckbox = screen.getByRole("checkbox");
    fireEvent.click(autoSendCheckbox);

    const sensitivitySlider = screen.getByRole("slider");
    fireEvent.change(sensitivitySlider, { target: { value: "25" } });

    const submitBtn = screen.getByText("Salvar");
    fireEvent.click(submitBtn);

    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: "http://192.168.1.100:8000",
        playerName: "Legolas",
        autoSend: true,
        motionSensitivity: 25,
      })
    );
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("closes when cancel or close button is clicked", () => {
    const onCloseMock = vi.fn();

    render(
      <SettingsModal
        settings={DEFAULT_SETTINGS}
        onSave={vi.fn()}
        onClose={onCloseMock}
      />
    );

    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("✕"));
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });
});

describe("RecentRolls Component", () => {
  it("returns null when rolls array is empty", () => {
    const { container } = render(<RecentRolls rolls={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders list of recent rolls", () => {
    const rolls: RollEvent[] = [
      { id: "1", die_type: "d20", value: 20, player_name: "Gimli" },
      { id: "2", die_type: "d6", value: 6, player_name: "Frodo" },
    ];

    render(<RecentRolls rolls={rolls} />);

    expect(screen.getByText("Últimas Rolagens")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Gimli")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Frodo")).toBeInTheDocument();
  });

  it("renders default Jogador when player_name is undefined", () => {
    const rolls: RollEvent[] = [
      { id: "3", die_type: "d8", value: 8 },
    ];

    render(<RecentRolls rolls={rolls} />);
    expect(screen.getByText("Jogador")).toBeInTheDocument();
  });
});
