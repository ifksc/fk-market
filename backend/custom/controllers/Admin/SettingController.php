<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Setting::orderBy('key')->get()->map(fn (Setting $s) => [
                'key' => $s->key,
                'value' => $s->value,
                'type' => $s->type,
                'description' => $s->description,
            ]),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string', 'max:120'],
            'settings.*.value' => ['nullable', 'string', 'max:5000'],
        ]);

        foreach ($data['settings'] as $row) {
            Setting::where('key', $row['key'])->update(['value' => $row['value']]);
        }

        return response()->json(['data' => ['ok' => true, 'count' => count($data['settings'])]]);
    }
}
