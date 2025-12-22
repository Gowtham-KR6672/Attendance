import mongoose from "mongoose";

const ProcessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    headers: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, default: "text" }, // text | number | date | formula
        formula: { type: String, default: "" }, // ✅ for formula columns
      },
    ],

    // ✅ Chart settings stored per process
    chart: {
      type: { type: String, default: "bar" }, // bar | line | pie
      xField: { type: String, default: "" },
      yField: { type: String, default: "" },
      color: { type: String, default: "#1b3f8dff" }, // editable color
      title: { type: String, default: "" },
      showLegend: { type: Boolean, default: true },
    },

    headerVersion: { type: Number, default: 1 }, // ✅ bump when headers edited
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

export default mongoose.model("Process", ProcessSchema);
