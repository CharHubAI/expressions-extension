---
language: en
tags:
- text-classification
- onnx
- int8
- roberta
- emotions
- multi-class-classification
- multi-label-classification
- optimum
datasets:
- go_emotions
license: mit
inference: false
widget:
- text: Thank goodness ONNX is available, it is lots faster!
---

This model is the ONNX version of [https://huggingface.co/SamLowe/roberta-base-go_emotions](https://huggingface.co/SamLowe/roberta-base-go_emotions).

### Full precision ONNX version

`onnx/model.onnx` is the full precision ONNX version

- that has identical accuracy/metrics to the original Transformers model
- and has the same model size (499MB)
- is faster in inference than normal Transformers, particularly for smaller batch sizes
  - in my tests about 2x to 3x as fast for a batch size of 1 on a 8 core 11th gen i7 CPU using ONNXRuntime

#### Metrics

Using a fixed threshold of 0.5 to convert the scores to binary predictions for each label:

- Accuracy: 0.474
- Precision: 0.575
- Recall: 0.396
- F1: 0.450

See more details in the SamLowe/roberta-base-go_emotions model card for the increases possible through selecting label-specific thresholds to maximise F1 scores, or another metric.

### Quantized (INT8) ONNX version

`onnx/model_quantized.onnx` is the int8 quantized version 

- that is one quarter the size (125MB) of the full precision model (above)
- but delivers almost all of the accuracy
- is faster in inference than both the full precision ONNX above, and the normal Transformers model
  - about 2x as fast for a batch size of 1 on an 8 core 11th gen i7 CPU using ONNXRuntime vs the full precision model above
  - which makes it circa 5x as fast as the full precision normal Transformers model (on the above mentioned CPU, for a batch of 1)
 
#### Metrics for Quantized (INT8) Model

Using a fixed threshold of 0.5 to convert the scores to binary predictions for each label:

- Accuracy: 0.475
- Precision: 0.582
- Recall: 0.398
- F1: 0.447

Note how the metrics are almost identical to the full precision metrics above.

See more details in the SamLowe/roberta-base-go_emotions model card for the increases possible through selecting label-specific thresholds to maximise F1 scores, or another metric.

### How to use

#### Using Optimum Library ONNX Classes

Optimum library has equivalents (starting `ORT`) for the main Transformers classes, so these models can be used with the familiar constructs. The only extra property needed is `file_name` on the model creation, which in the below example specifies the quantized (INT8) model. 

```python
sentences = ["ONNX is seriously fast for small batches. Impressive"]

from transformers import AutoTokenizer, pipeline
from optimum.onnxruntime import ORTModelForSequenceClassification

model_id = "SamLowe/roberta-base-go_emotions-onnx"
file_name = "onnx/model_quantized.onnx"

model = ORTModelForSequenceClassification.from_pretrained(model_id, file_name=file_name)
tokenizer = AutoTokenizer.from_pretrained(model_id)

onnx_classifier = pipeline(
    task="text-classification",
    model=model,
    tokenizer=tokenizer,
    top_k=None,
    function_to_apply="sigmoid",  # optional as is the default for the task
)

model_outputs = onnx_classifier(sentences)
# gives a list of outputs, each a list of dicts (one per label)

print(model_outputs)
# E.g.
# [[{'label': 'admiration', 'score': 0.9203393459320068},
#   {'label': 'approval', 'score': 0.0560273639857769},
#   {'label': 'neutral', 'score': 0.04265536740422249},
#   {'label': 'gratitude', 'score': 0.015126707963645458},
# ...
```

#### Using ONNXRuntime

- Tokenization can be done before with the `tokenizers` library,
- and then the fed into ONNXRuntime as the type of dict it uses,
- and then simply the postprocessing sigmoid is needed afterward on the model output (which comes as a numpy array) to create the embeddings.

```python
from tokenizers import Tokenizer
import onnxruntime as ort

from os import cpu_count
import numpy as np  # only used for the postprocessing sigmoid

sentences = ["hello world"]  # for example a batch of 1

# labels as (ordered) list - from the go_emotions dataset
labels = ['admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness', 'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise', 'neutral']

tokenizer = Tokenizer.from_pretrained("SamLowe/roberta-base-go_emotions")

# Optional - set pad to only pad to longest in batch, not a fixed length.
# (without this, the model will run slower, esp for shorter input strings)
params = {**tokenizer.padding, "length": None}
tokenizer.enable_padding(**params)

tokens_obj = tokenizer.encode_batch(sentences)

def load_onnx_model(model_filepath):
    _options = ort.SessionOptions()
    _options.inter_op_num_threads, _options.intra_op_num_threads = cpu_count(), cpu_count()
    _providers = ["CPUExecutionProvider"]  # could use ort.get_available_providers()
    return ort.InferenceSession(path_or_bytes=model_filepath, sess_options=_options, providers=_providers)

model = load_onnx_model("path_to_model_dot_onnx_or_model_quantized_dot_onnx")
output_names = [model.get_outputs()[0].name]  # E.g. ["logits"]

input_feed_dict = {
  "input_ids": [t.ids for t in tokens_obj],
  "attention_mask": [t.attention_mask for t in tokens_obj]
}

logits = model.run(output_names=output_names, input_feed=input_feed_dict)[0]
# produces a numpy array, one row per input item, one col per label

def sigmoid(x):
  return 1.0 / (1.0 + np.exp(-x))

# Post-processing. Gets the scores per label in range.
# Auto done by Transformers' pipeline, but we must do it manually with ORT.
model_outputs = sigmoid(logits) 

# for example, just to show the top result per input item
for probas in model_outputs:
  top_result_index = np.argmax(probas)
  print(labels[top_result_index], "with score:", probas[top_result_index])
```

### Example notebook: showing usage, accuracy & performance

Notebook with more details to follow.