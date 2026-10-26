import pytest
from pydantic import ValidationError
from app.schemas.dice import DieType, RecognizeRequest, RecognitionResult, RollEvent

def test_recognize_request_validation():
    # Valid with hint
    req = RecognizeRequest(
        image_base64="data:image/jpeg;base64,1234567890abcdefghij",
        die_type_hint=DieType.D20
    )
    assert req.die_type_hint == DieType.D20

    # Valid without hint
    req2 = RecognizeRequest(image_base64="1234567890abcdefghij")
    assert req2.die_type_hint is None

    # Invalid empty image
    with pytest.raises(ValidationError):
        RecognizeRequest(image_base64="")

    # Invalid too short image
    with pytest.raises(ValidationError):
        RecognizeRequest(image_base64="abc")

def test_recognition_result_validation():
    # Valid d20
    res = RecognitionResult(die_type=DieType.D20, value=20, confidence=0.99)
    assert res.value == 20
    assert res.die_type == "d20"

    # Valid d100 boundaries (0 and 100)
    res_d100_min = RecognitionResult(die_type=DieType.D100, value=0, confidence=1.0)
    assert res_d100_min.value == 0
    res_d100_max = RecognitionResult(die_type=DieType.D100, value=100, confidence=1.0)
    assert res_d100_max.value == 100

    # Invalid d100 values (< 0 or > 100)
    with pytest.raises(ValidationError):
        RecognitionResult(die_type=DieType.D100, value=-1, confidence=1.0)
    with pytest.raises(ValidationError):
        RecognitionResult(die_type=DieType.D100, value=101, confidence=1.0)

    # Valid other dice (d4, d6, d8, d10, d12)
    assert RecognitionResult(die_type=DieType.D4, value=4).value == 4
    assert RecognitionResult(die_type=DieType.D6, value=6).value == 6
    assert RecognitionResult(die_type=DieType.D8, value=8).value == 8
    assert RecognitionResult(die_type=DieType.D10, value=10).value == 10
    assert RecognitionResult(die_type=DieType.D12, value=12).value == 12

    # Invalid d4
    with pytest.raises(ValidationError):
        RecognitionResult(die_type=DieType.D4, value=5)

    # Invalid d20 (21 is out of range)
    with pytest.raises(ValidationError):
        RecognitionResult(die_type=DieType.D20, value=21, confidence=0.99)

    # Invalid d6 (0 is out of range)
    with pytest.raises(ValidationError):
        RecognitionResult(die_type=DieType.D6, value=0, confidence=0.99)

    # Test validator when die_type is missing from validation context info
    class DummyInfo:
        data = {}
    assert RecognitionResult.validate_value_range(15, DummyInfo()) == 15

def test_roll_event():
    event = RollEvent(id="roll_1", die_type=DieType.D12, value=11, player_name="Geralt")
    assert event.id == "roll_1"
    assert event.value == 11
    assert event.player_name == "Geralt"
    assert event.source == "optical_camera"
    assert event.timestamp is not None
